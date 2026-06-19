import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignId, useCampaignRole } from '../context/CampaignContext'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { MarkdownBody } from '../components/MarkdownBody'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  LOCATION_HIERARCHY,
  LOCATION_SUBTYPE_INDEX,
  type LocationSubtype,
  type WikiCategory,
} from '../constants/wiki'
import { exportWikiArticle, useDeleteWikiArticle, useWikiArticle } from '../hooks/useWiki'
import type { WikiAssociationDisplay } from '../types'

// ---------------------------------------------------------------------------
// Location hierarchy view
// ---------------------------------------------------------------------------

interface LocationHierarchyViewProps {
  subtype: LocationSubtype
  associations: WikiAssociationDisplay[]
}

function LocationHierarchyView({ subtype, associations }: LocationHierarchyViewProps) {
  const myLevel = LOCATION_SUBTYPE_INDEX[subtype]
  const myChildLabel = LOCATION_HIERARCHY[myLevel].childLabel

  // Parent associations: incoming (direction=to) with label = my childLabel
  const parentAssocs = associations.filter(
    (a) => a.direction === 'to' && a.association_label === myChildLabel && a.other_article_category === 'location',
  )

  // Child associations: outgoing (direction=from) with label = child's childLabel
  const childLevel = myLevel < LOCATION_HIERARCHY.length - 1 ? LOCATION_HIERARCHY[myLevel + 1] : null
  const childAssocs = childLevel
    ? associations.filter(
        (a) => a.direction === 'from' && a.association_label === childLevel.childLabel && a.other_article_category === 'location',
      )
    : []

  if (parentAssocs.length === 0 && childAssocs.length === 0) return null

  const myTypeLabel = LOCATION_HIERARCHY[myLevel].label

  return (
    <div className="wiki-assoc-panel" style={{ marginTop: '0.75rem' }}>
      <div className="wiki-assoc-panel-title">Location Hierarchy</div>

      {parentAssocs.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          {parentAssocs.map((assoc) => {
            const parentLevel = LOCATION_HIERARCHY.find(
              (l) => l.subtype === assoc.other_article_location_subtype,
            )
            return (
              <div key={assoc.id} style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {parentLevel?.label ?? 'Parent'}:{' '}
                </span>
                <Link
                  to={`/wiki/${assoc.other_article_id}`}
                  style={{ color: CATEGORY_COLORS['location'], fontWeight: 500 }}
                >
                  {assoc.other_article_title}
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {parentAssocs.length > 0 && childAssocs.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', margin: '0.4rem 0' }} />
      )}

      {childAssocs.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            {childLevel!.plural} of {myTypeLabel}
          </div>
          <div className="wiki-assoc-chips">
            {childAssocs.map((assoc) => (
              <Link
                key={assoc.id}
                to={`/wiki/${assoc.other_article_id}`}
                className="wiki-assoc-chip"
              >
                <span className="wiki-assoc-chip-title">
                  {assoc.other_article_title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function WikiArticlePage() {
  const { articleId } = useParams<{ articleId: string }>()
  const campaignId = useCampaignId()
  const navigate = useNavigate()

  const { data: currentUser } = useCurrentUser()
  const campaignRole = useCampaignRole()
  const canEdit = currentUser?.is_admin || campaignRole === 'owner' || campaignRole === 'game_master'

  const { data: article, isLoading } = useWikiArticle(articleId!)
  const deleteArticle = useDeleteWikiArticle(campaignId!)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)

  async function handleExport() {
    if (!article) return
    setExporting(true)
    try {
      await exportWikiArticle(articleId!, article.title)
    } finally {
      setExporting(false)
    }
  }

  function handleDelete() {
    deleteArticle.mutate(articleId!, {
      onSuccess: () => navigate('/wiki'),
    })
  }

  if (isLoading) return <div className="status-text">Loading…</div>
  if (!article) return <div className="status-text">Article not found.</div>

  const catColor = CATEGORY_COLORS[article.category as WikiCategory] ?? '#888'
  const catLabel = CATEGORY_LABELS[article.category as WikiCategory] ?? article.category

  const isLocation = article.category === 'location' && !!article.location_subtype
  const locationSubtype = isLocation ? (article.location_subtype as LocationSubtype) : null

  // Hierarchy-managed associations (excluded from the generic panel)
  const hierarchyAssocIds = new Set<string>()
  if (locationSubtype) {
    const myLevel = LOCATION_SUBTYPE_INDEX[locationSubtype]
    const myChildLabel = LOCATION_HIERARCHY[myLevel].childLabel
    const childLevel = myLevel < LOCATION_HIERARCHY.length - 1 ? LOCATION_HIERARCHY[myLevel + 1] : null
    article.associations.forEach((a) => {
      if (a.direction === 'to' && a.association_label === myChildLabel && a.other_article_category === 'location') {
        hierarchyAssocIds.add(a.id)
      }
      if (childLevel && a.direction === 'from' && a.association_label === childLevel.childLabel && a.other_article_category === 'location') {
        hierarchyAssocIds.add(a.id)
      }
    })
  }
  const genericAssociations = article.associations.filter((a) => !hierarchyAssocIds.has(a.id))

  const hasDetailCol =
    article.image_url ||
    genericAssociations.length > 0 ||
    (article.tags && article.tags.length > 0) ||
    (locationSubtype && article.associations.some((a) => hierarchyAssocIds.has(a.id)))

  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link
          to={`/wiki`}
          className="nav-link"
          style={{ fontSize: '0.875rem', marginTop: '0.3rem' }}
        >
          ← Wiki
        </Link>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn-ghost"
            type="button"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          {canEdit && (
            <Link to={`/wiki/${articleId}/edit`} className="btn-ghost">
              Edit
            </Link>
          )}
          {canEdit && (deleteConfirm ? (
            <>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Delete?</span>
              <button
                className="btn-icon btn-danger"
                type="button"
                onClick={handleDelete}
                disabled={deleteArticle.isPending}
              >
                Yes
              </button>
              <button
                className="btn-icon"
                type="button"
                onClick={() => setDeleteConfirm(false)}
              >
                No
              </button>
            </>
          ) : (
            <button
              className="btn-icon btn-danger"
              type="button"
              onClick={() => setDeleteConfirm(true)}
              title="Delete article"
            >
              ✕
            </button>
          ))}
        </div>
      </div>

      <div className="wiki-article">
        {article.is_stub && (
          <div className="wiki-stub-banner">
            This article is a stub — click <strong>Edit</strong> to fill it in.
          </div>
        )}

        <div className="wiki-article-header">
          <h1 className="wiki-article-title">{article.title}</h1>
          <span className="wiki-category-badge" style={{ color: catColor }}>
            {catLabel}
          </span>
          {locationSubtype && (
            <span className="wiki-category-badge" style={{ color: CATEGORY_COLORS['location'], fontSize: '0.75rem' }}>
              {LOCATION_HIERARCHY.find((l) => l.subtype === locationSubtype)?.label}
            </span>
          )}
          {article.is_stub && <span className="wiki-stub-badge">Stub</span>}
        </div>

        {/* Right details column */}
        {hasDetailCol && (
          <div className="wiki-details-col">
            {article.image_url && (
              <>
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="wiki-article-image-thumb"
                  onClick={() => setImageOpen(true)}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
                {imageOpen && (
                  <div
                    className="wiki-image-modal-overlay"
                    onClick={() => setImageOpen(false)}
                  >
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="wiki-image-modal-img"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </>
            )}

            {/* Location hierarchy panel */}
            {locationSubtype && (
              <LocationHierarchyView
                subtype={locationSubtype}
                associations={article.associations}
              />
            )}

            {genericAssociations.length > 0 && (
              <div className="wiki-assoc-panel">
                <div className="wiki-assoc-panel-title">Associations</div>
                <div className="wiki-assoc-chips">
                  {genericAssociations.map((assoc) => (
                    <Link
                      key={assoc.id}
                      to={`/wiki/${assoc.other_article_id}`}
                      className="wiki-assoc-chip"
                    >
                      <span className="wiki-assoc-chip-title">
                        {assoc.other_article_title}
                        <span
                          style={{
                            marginLeft: '0.35rem',
                            fontSize: '0.65rem',
                            color: CATEGORY_COLORS[assoc.other_article_category as WikiCategory] ?? '#888',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {CATEGORY_LABELS[assoc.other_article_category as WikiCategory] ?? assoc.other_article_category}
                        </span>
                      </span>
                      <span className="wiki-assoc-chip-label">
                        {assoc.direction === 'from'
                          ? `→ ${assoc.association_label}`
                          : `← ${assoc.association_label}`}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {article.tags && article.tags.length > 0 && (
              <div className="wiki-tag-list">
                {article.tags.map((tag) => (
                  <span key={tag} className="wiki-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        {article.public_content && (
          <div className="wiki-section">
            <div className="wiki-section-title">Public</div>
            <MarkdownBody content={article.public_content} />
          </div>
        )}

        {article.private_content && (
          <div className="wiki-private-section">
            <div className="wiki-private-label">DM Only</div>
            <MarkdownBody content={article.private_content} />
          </div>
        )}

        {!article.public_content && !article.private_content && !article.is_stub && (
          <p className="empty-state" style={{ marginTop: '1rem' }}>
            No content yet. Click Edit to add some.
          </p>
        )}
      </div>
    </div>
  )
}
