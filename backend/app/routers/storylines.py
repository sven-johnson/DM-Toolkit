import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession, selectinload

from ..auth import get_current_user, require_campaign_role
from ..database import get_db
from ..models import Check, Scene, SceneEnemy, SceneShopItem, Storyline, User
from ..schemas import (
    SceneCreate,
    SceneOut,
    SceneReorder,
    StorylineCreate,
    StorylineExportEnemy,
    StorylineExportItem,
    StorylineExportResponse,
    StorylineExportScene,
    StorylineExportShopItem,
    StorylineImportRequest,
    StorylineImportResult,
    StorylineOut,
    StorylineUpdate,
    StorylineWithScenes,
)

router = APIRouter()


@router.post("", response_model=StorylineOut, status_code=status.HTTP_201_CREATED)
def create_storyline(
    campaign_id: str,
    body: StorylineCreate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Storyline:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    order_index = (
        db.query(func.coalesce(func.max(Storyline.order_index), -1))
        .filter(Storyline.campaign_id == campaign_id)
        .scalar() + 1
    )
    storyline = Storyline(
        id=str(uuid_lib.uuid4()),
        campaign_id=campaign_id,
        order_index=order_index,
        **body.model_dump(),
    )
    db.add(storyline)
    db.commit()
    db.refresh(storyline)
    return storyline


def _storyline_to_export(storyline: Storyline) -> StorylineExportItem:
    scenes_out = []
    for scene in sorted(storyline.scenes, key=lambda s: s.order_index):
        scenes_out.append(
            StorylineExportScene(
                title=scene.title,
                body=scene.body or "",
                dm_notes=scene.dm_notes,
                scene_type=scene.scene_type,
                puzzle_clues=scene.puzzle_clues,
                puzzle_solution=scene.puzzle_solution,
                music_cue=scene.music_cue,
                enemies=[
                    StorylineExportEnemy(name=e.name, quantity=e.quantity)
                    for e in sorted(scene.enemies, key=lambda e: e.order_index)
                ],
                shop_items=[
                    StorylineExportShopItem(
                        name=i.name,
                        description=i.description,
                        price=i.price,
                        currency=i.currency,
                    )
                    for i in sorted(scene.shop_items, key=lambda i: i.order_index)
                ],
            )
        )
    return StorylineExportItem(
        title=storyline.title,
        description=storyline.description,
        scenes=scenes_out,
    )


def _load_storyline_full(db: DBSession, storyline_id: str) -> Storyline | None:
    return (
        db.query(Storyline)
        .options(
            selectinload(Storyline.scenes).selectinload(Scene.enemies),
            selectinload(Storyline.scenes).selectinload(Scene.shop_items),
        )
        .filter(Storyline.id == storyline_id)
        .first()
    )


@router.get("/export", response_model=StorylineExportResponse)
def export_storylines(
    campaign_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StorylineExportResponse:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    storylines = (
        db.query(Storyline)
        .options(
            selectinload(Storyline.scenes).selectinload(Scene.enemies),
            selectinload(Storyline.scenes).selectinload(Scene.shop_items),
        )
        .filter(Storyline.campaign_id == campaign_id)
        .order_by(Storyline.order_index)
        .all()
    )
    return StorylineExportResponse(
        campaign_id=campaign_id,
        storylines=[_storyline_to_export(s) for s in storylines],
    )


@router.post(
    "/import",
    response_model=StorylineImportResult,
    status_code=status.HTTP_200_OK,
)
def import_storylines(
    campaign_id: str,
    body: StorylineImportRequest,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StorylineImportResult:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    storylines_created = 0
    storylines_updated = 0
    scenes_created = 0
    scenes_updated = 0
    errors: list[str] = []

    existing_storylines = (
        db.query(Storyline).filter(Storyline.campaign_id == campaign_id).all()
    )
    title_map: dict[str, Storyline] = {s.title: s for s in existing_storylines}

    for imp_sl in body.storylines:
        try:
            storyline = title_map.get(imp_sl.title)
            if storyline:
                storyline.description = imp_sl.description
                db.flush()
                storylines_updated += 1
            else:
                order_index = (
                    db.query(func.coalesce(func.max(Storyline.order_index), -1))
                    .filter(Storyline.campaign_id == campaign_id)
                    .scalar() + 1
                )
                storyline = Storyline(
                    id=str(uuid_lib.uuid4()),
                    campaign_id=campaign_id,
                    title=imp_sl.title,
                    description=imp_sl.description,
                    order_index=order_index,
                )
                db.add(storyline)
                db.flush()
                title_map[storyline.title] = storyline
                storylines_created += 1

            existing_scenes = (
                db.query(Scene)
                .options(
                    selectinload(Scene.enemies),
                    selectinload(Scene.shop_items),
                )
                .filter(Scene.storyline_id == storyline.id)
                .all()
            )
            scene_title_map: dict[str, Scene] = {s.title: s for s in existing_scenes}

            for idx, imp_sc in enumerate(imp_sl.scenes):
                try:
                    scene = scene_title_map.get(imp_sc.title)
                    if scene:
                        scene.body = imp_sc.body
                        scene.dm_notes = imp_sc.dm_notes
                        scene.scene_type = imp_sc.scene_type
                        scene.puzzle_clues = imp_sc.puzzle_clues
                        scene.puzzle_solution = imp_sc.puzzle_solution
                        scene.music_cue = imp_sc.music_cue
                        scene.order_index = idx
                        db.flush()
                        db.query(SceneEnemy).filter(SceneEnemy.scene_id == scene.id).delete(synchronize_session=False)
                        db.query(SceneShopItem).filter(SceneShopItem.scene_id == scene.id).delete(synchronize_session=False)
                        db.flush()
                        scenes_updated += 1
                    else:
                        scene = Scene(
                            id=str(uuid_lib.uuid4()),
                            storyline_id=storyline.id,
                            title=imp_sc.title,
                            body=imp_sc.body,
                            dm_notes=imp_sc.dm_notes,
                            scene_type=imp_sc.scene_type,
                            puzzle_clues=imp_sc.puzzle_clues,
                            puzzle_solution=imp_sc.puzzle_solution,
                            music_cue=imp_sc.music_cue,
                            order_index=idx,
                        )
                        db.add(scene)
                        db.flush()
                        scene_title_map[scene.title] = scene
                        scenes_created += 1

                    for e_idx, e in enumerate(imp_sc.enemies):
                        db.add(SceneEnemy(
                            id=str(uuid_lib.uuid4()),
                            scene_id=scene.id,
                            name=e.name,
                            quantity=e.quantity,
                            order_index=e_idx,
                        ))
                    for i_idx, i in enumerate(imp_sc.shop_items):
                        db.add(SceneShopItem(
                            id=str(uuid_lib.uuid4()),
                            scene_id=scene.id,
                            name=i.name,
                            description=i.description,
                            price=i.price,
                            currency=i.currency,
                            order_index=i_idx,
                        ))
                    db.flush()
                except Exception as exc:
                    errors.append(f"Scene '{imp_sc.title}' in '{imp_sl.title}': {exc}")

        except Exception as exc:
            errors.append(f"Storyline '{imp_sl.title}': {exc}")

    db.commit()
    return StorylineImportResult(
        storylines_created=storylines_created,
        storylines_updated=storylines_updated,
        scenes_created=scenes_created,
        scenes_updated=scenes_updated,
        errors=errors,
    )


@router.get("/{storyline_id}/export", response_model=StorylineExportResponse)
def export_storyline(
    campaign_id: str,
    storyline_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StorylineExportResponse:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    storyline = _load_storyline_full(db, storyline_id)
    if not storyline or storyline.campaign_id != campaign_id:
        raise HTTPException(status_code=404, detail="Storyline not found")
    return StorylineExportResponse(
        campaign_id=campaign_id,
        storylines=[_storyline_to_export(storyline)],
    )


@router.get("/{storyline_id}", response_model=StorylineWithScenes)
def get_storyline(
    campaign_id: str,
    storyline_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Storyline:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    storyline = (
        db.query(Storyline)
        .options(
            selectinload(Storyline.scenes)
            .selectinload(Scene.checks)
            .selectinload(Check.rolls)
        )
        .options(
            selectinload(Storyline.scenes).selectinload(Scene.enemies)
        )
        .options(
            selectinload(Storyline.scenes).selectinload(Scene.shop_items)
        )
        .filter(Storyline.id == storyline_id)
        .first()
    )
    if not storyline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")
    return storyline


@router.put("/{storyline_id}", response_model=StorylineOut)
def update_storyline(
    campaign_id: str,
    storyline_id: str,
    body: StorylineUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Storyline:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    storyline = db.query(Storyline).filter(Storyline.id == storyline_id).first()
    if not storyline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(storyline, key, value)
    db.commit()
    db.refresh(storyline)
    return storyline


@router.delete("/{storyline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_storyline(
    campaign_id: str,
    storyline_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    storyline = db.query(Storyline).filter(Storyline.id == storyline_id).first()
    if not storyline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")
    db.delete(storyline)
    db.commit()


@router.post(
    "/{storyline_id}/scenes",
    response_model=SceneOut,
    status_code=status.HTTP_201_CREATED,
)
def create_scene(
    campaign_id: str,
    storyline_id: str,
    body: SceneCreate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Scene:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    if not db.query(Storyline).filter(Storyline.id == storyline_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")
    order_index = (
        db.query(func.coalesce(func.max(Scene.order_index), -1))
        .filter(Scene.storyline_id == storyline_id)
        .scalar() + 1
    )
    scene = Scene(
        id=str(uuid_lib.uuid4()),
        storyline_id=storyline_id,
        order_index=order_index,
        **body.model_dump(),
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.put("/{storyline_id}/scenes/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_scenes(
    campaign_id: str,
    storyline_id: str,
    body: SceneReorder,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    scenes = db.query(Scene).filter(Scene.storyline_id == storyline_id).all()
    scene_map = {s.id: s for s in scenes}
    for index, scene_id in enumerate(body.scene_ids):
        if scene_id in scene_map:
            scene_map[scene_id].order_index = index
    db.commit()
