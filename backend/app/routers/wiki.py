from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session as DBSession

from ..auth import verify_token
from ..database import get_db
from ..models import Campaign, WikiArticle, WikiAssociation
from ..schemas import (
    WikiAddAssociationRequest,
    WikiAddAssociationResult,
    WikiArticleCreate,
    WikiArticleDetail,
    WikiArticleOut,
    WikiArticleUpdate,
    WikiAssociationDisplay,
    WikiExportArticle,
    WikiExportAssociation,
    WikiExportResponse,
    WikiImportRequest,
    WikiImportResult,
)

router = APIRouter()


def _hydrate_associations(
    article: WikiArticle, db: DBSession
) -> list[WikiAssociationDisplay]:
    assocs = (
        db.query(WikiAssociation)
        .filter(
            or_(
                WikiAssociation.source_article_id == article.id,
                WikiAssociation.target_article_id == article.id,
            )
        )
        .all()
    )

    result = []
    for assoc in assocs:
        if assoc.source_article_id == article.id:
            other = (
                db.query(WikiArticle)
                .filter(WikiArticle.id == assoc.target_article_id)
                .first()
            )
            direction = "from"
            other_id = assoc.target_article_id
        else:
            other = (
                db.query(WikiArticle)
                .filter(WikiArticle.id == assoc.source_article_id)
                .first()
            )
            direction = "to"
            other_id = assoc.source_article_id

        result.append(
            WikiAssociationDisplay(
                id=assoc.id,
                association_label=assoc.association_label,
                other_article_id=other_id,
                other_article_title=other.title if other else "Unknown",
                other_article_category=other.category if other else "other",
                direction=direction,
            )
        )
    return result


# Declare /export and /import before /{article_id} so literal segments take precedence


@router.get("/export", response_model=WikiExportResponse)
def export_all_wiki(
    campaign_id: int = Query(...),
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> WikiExportResponse:
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=404, detail="Campaign not found")

    articles = (
        db.query(WikiArticle)
        .filter(WikiArticle.campaign_id == campaign_id)
        .order_by(WikiArticle.title)
        .all()
    )

    export_articles = []
    for article in articles:
        outbound = (
            db.query(WikiAssociation)
            .filter(WikiAssociation.source_article_id == article.id)
            .all()
        )
        assoc_exports = []
        for assoc in outbound:
            target = (
                db.query(WikiArticle)
                .filter(WikiArticle.id == assoc.target_article_id)
                .first()
            )
            if target:
                assoc_exports.append(
                    WikiExportAssociation(
                        target_title=target.title,
                        target_category=target.category,
                        association_label=assoc.association_label,
                    )
                )
        export_articles.append(
            WikiExportArticle(
                title=article.title,
                category=article.category,
                is_stub=article.is_stub,
                image_url=article.image_url,
                tags=article.tags,
                public_content=article.public_content,
                private_content=article.private_content,
                associations=assoc_exports,
            )
        )

    return WikiExportResponse(campaign_id=campaign_id, articles=export_articles)


@router.post(
    "/import",
    response_model=WikiImportResult,
    status_code=status.HTTP_200_OK,
)
def import_wiki(
    body: WikiImportRequest,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> WikiImportResult:
    """
    Bulk-import wiki articles and associations from a portable JSON document.

    Format
    ------
    {
      "campaign_id": <int>,
      "articles": [
        {
          "title": "Verso",
          "category": "npc",
          "is_stub": false,
          "image_url": null,
          "tags": ["player", "druid"],
          "public_content": "A wood elf druid...",
          "private_content": "Haunted by spirits...",
          "associations": [
            {
              "target_title": "Vel Anaris",
              "target_category": "city",
              "association_label": "lives in"
            }
          ]
        }
      ]
    }

    Article matching is by (title + campaign_id). An existing article is
    updated; a new title creates a new article. If a previously-stubbed article
    receives non-empty public_content or private_content, its is_stub flag is
    cleared automatically (unless the import explicitly sets is_stub = true).

    Association targets that do not exist in the campaign are automatically
    created as stub articles using the supplied target_category (defaulting to
    "other"). Duplicate associations (same source, target, label) are silently
    skipped. All articles are processed before associations, so forward
    references within the same import payload resolve correctly.

    Returns counts of created articles, updated articles, stubs created, and
    any per-item error messages.
    """
    if not db.query(Campaign).filter(Campaign.id == body.campaign_id).first():
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign_id = body.campaign_id
    created = 0
    updated = 0
    stubs_created = 0
    errors: list[str] = []

    # Build title → id map from existing articles
    title_map: dict[str, int] = {
        a.title: a.id
        for a in db.query(WikiArticle)
        .filter(WikiArticle.campaign_id == campaign_id)
        .all()
    }

    # --- Pass 1: upsert articles ---
    for imp in body.articles:
        try:
            existing_id = title_map.get(imp.title)
            if existing_id is not None:
                art = db.query(WikiArticle).filter(WikiArticle.id == existing_id).first()
                if art:
                    effective_is_stub = imp.is_stub
                    if art.is_stub and not imp.is_stub:
                        if imp.public_content or imp.private_content:
                            effective_is_stub = False
                    art.category = imp.category
                    art.is_stub = effective_is_stub
                    art.image_url = imp.image_url
                    art.tags = imp.tags
                    art.public_content = imp.public_content
                    art.private_content = imp.private_content
                    db.flush()
                    updated += 1
            else:
                art = WikiArticle(
                    campaign_id=campaign_id,
                    title=imp.title,
                    category=imp.category,
                    is_stub=imp.is_stub,
                    image_url=imp.image_url,
                    tags=imp.tags,
                    public_content=imp.public_content,
                    private_content=imp.private_content,
                )
                db.add(art)
                db.flush()
                title_map[art.title] = art.id
                created += 1
        except Exception as exc:
            errors.append(f"Article '{imp.title}': {exc}")

    db.commit()

    # Rebuild map to include any newly created articles
    title_map = {
        a.title: a.id
        for a in db.query(WikiArticle)
        .filter(WikiArticle.campaign_id == campaign_id)
        .all()
    }

    # --- Pass 2: upsert associations ---
    for imp in body.articles:
        source_id = title_map.get(imp.title)
        if source_id is None:
            continue
        for assoc_imp in imp.associations:
            try:
                target_id = title_map.get(assoc_imp.target_title)
                if target_id is None:
                    stub = WikiArticle(
                        campaign_id=campaign_id,
                        title=assoc_imp.target_title,
                        category=assoc_imp.target_category,
                        is_stub=True,
                        public_content="",
                        private_content="",
                    )
                    db.add(stub)
                    db.flush()
                    title_map[stub.title] = stub.id
                    target_id = stub.id
                    stubs_created += 1

                exists = (
                    db.query(WikiAssociation)
                    .filter(
                        WikiAssociation.source_article_id == source_id,
                        WikiAssociation.target_article_id == target_id,
                        WikiAssociation.association_label == assoc_imp.association_label,
                    )
                    .first()
                )
                if exists is None:
                    db.add(
                        WikiAssociation(
                            source_article_id=source_id,
                            target_article_id=target_id,
                            association_label=assoc_imp.association_label,
                        )
                    )
                    db.flush()
            except Exception as exc:
                errors.append(
                    f"Association '{imp.title}' → '{assoc_imp.target_title}': {exc}"
                )

    db.commit()

    return WikiImportResult(
        created=created,
        updated=updated,
        stubs_created=stubs_created,
        errors=errors,
    )


@router.get("", response_model=list[WikiArticleOut])
def list_wiki_articles(
    campaign_id: int = Query(...),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    stubs: Optional[bool] = Query(None),
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[WikiArticle]:
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = db.query(WikiArticle).filter(WikiArticle.campaign_id == campaign_id)
    if category:
        query = query.filter(WikiArticle.category == category)
    if q:
        query = query.filter(WikiArticle.title.ilike(f"%{q}%"))
    if stubs is not None:
        query = query.filter(WikiArticle.is_stub == stubs)
    articles = query.order_by(WikiArticle.title).all()
    if tag:
        tag_lower = tag.lower()
        articles = [a for a in articles if a.tags and any(tag_lower in t.lower() for t in a.tags)]
    return articles


@router.post("", response_model=WikiArticleOut, status_code=status.HTTP_201_CREATED)
def create_wiki_article(
    body: WikiArticleCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> WikiArticle:
    if not db.query(Campaign).filter(Campaign.id == body.campaign_id).first():
        raise HTTPException(status_code=404, detail="Campaign not found")
    existing = (
        db.query(WikiArticle)
        .filter(
            WikiArticle.campaign_id == body.campaign_id,
            WikiArticle.title == body.title,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="An article with this title already exists"
        )
    article = WikiArticle(**body.model_dump())
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.get("/{article_id}", response_model=WikiArticleDetail)
def get_wiki_article(
    article_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> WikiArticleDetail:
    article = db.query(WikiArticle).filter(WikiArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    article_base = WikiArticleOut.model_validate(article)
    associations = _hydrate_associations(article, db)
    return WikiArticleDetail(**article_base.model_dump(), associations=associations)


@router.put("/{article_id}", response_model=WikiArticleOut)
def update_wiki_article(
    article_id: int,
    body: WikiArticleUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> WikiArticle:
    article = db.query(WikiArticle).filter(WikiArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    article.title = body.title
    article.category = body.category
    article.is_stub = body.is_stub
    article.image_url = body.image_url
    article.tags = body.tags
    article.public_content = body.public_content
    article.private_content = body.private_content
    db.commit()
    db.refresh(article)
    return article


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wiki_article(
    article_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    article = db.query(WikiArticle).filter(WikiArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    db.delete(article)
    db.commit()


@router.get("/{article_id}/export", response_model=WikiExportResponse)
def export_single_article(
    article_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> WikiExportResponse:
    article = db.query(WikiArticle).filter(WikiArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    outbound = (
        db.query(WikiAssociation)
        .filter(WikiAssociation.source_article_id == article_id)
        .all()
    )
    assoc_exports = []
    for assoc in outbound:
        target = (
            db.query(WikiArticle).filter(WikiArticle.id == assoc.target_article_id).first()
        )
        if target:
            assoc_exports.append(
                WikiExportAssociation(
                    target_title=target.title,
                    target_category=target.category,
                    association_label=assoc.association_label,
                )
            )
    return WikiExportResponse(
        campaign_id=article.campaign_id,
        articles=[
            WikiExportArticle(
                title=article.title,
                category=article.category,
                is_stub=article.is_stub,
                image_url=article.image_url,
                tags=article.tags,
                public_content=article.public_content,
                private_content=article.private_content,
                associations=assoc_exports,
            )
        ],
    )


@router.post(
    "/{article_id}/associations",
    response_model=WikiAddAssociationResult,
    status_code=status.HTTP_201_CREATED,
)
def add_association(
    article_id: int,
    body: WikiAddAssociationRequest,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> WikiAddAssociationResult:
    article = db.query(WikiArticle).filter(WikiArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    target = (
        db.query(WikiArticle)
        .filter(
            WikiArticle.campaign_id == article.campaign_id,
            WikiArticle.title == body.target_title,
        )
        .first()
    )

    stub_created = False
    stub_article_id: Optional[int] = None

    if target is None:
        target = WikiArticle(
            campaign_id=article.campaign_id,
            title=body.target_title,
            category=body.target_category,
            is_stub=True,
            public_content="",
            private_content="",
        )
        db.add(target)
        db.flush()
        stub_created = True
        stub_article_id = target.id

    existing = (
        db.query(WikiAssociation)
        .filter(
            WikiAssociation.source_article_id == article_id,
            WikiAssociation.target_article_id == target.id,
            WikiAssociation.association_label == body.association_label,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This association already exists")

    assoc = WikiAssociation(
        source_article_id=article_id,
        target_article_id=target.id,
        association_label=body.association_label,
    )
    db.add(assoc)
    db.commit()
    db.refresh(assoc)

    return WikiAddAssociationResult(
        association_id=assoc.id,
        stub_created=stub_created,
        stub_article_id=stub_article_id,
    )


@router.delete(
    "/associations/{association_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_association(
    association_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    assoc = (
        db.query(WikiAssociation)
        .filter(WikiAssociation.id == association_id)
        .first()
    )
    if not assoc:
        raise HTTPException(status_code=404, detail="Association not found")
    db.delete(assoc)
    db.commit()
