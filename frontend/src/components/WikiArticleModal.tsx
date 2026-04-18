import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MarkdownBody } from './MarkdownBody'
import { CATEGORY_COLORS, CATEGORY_LABELS, type WikiCategory } from '../constants/wiki'
import { useWikiArticle } from '../hooks/useWiki'

interface Props {
  articleId: number | null
  campaignId: number
  onClose: () => void
  onNavigate?: (articleId: number) => void
}

export function WikiArticleModal({ articleId, campaignId, onClose, onNavigate }: Props) {
  const { data: article, isLoading } = useWikiArticle(articleId ?? undefined)

  useEffect(() => {
    if (!articleId) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [articleId, onClose])

  if (!articleId) return null

  const catColor = article ? (CATEGORY_COLORS[article.category as WikiCategory] ?? '#888') : '#888'
  const catLabel = article ? (CATEGORY_LABELS[article.category as WikiCategory] ?? article.category) : ''

  return createPortal(
    <div className="character-modal-overlay" onClick={onClose}>
      <div
        className="character-modal wiki-article-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={article ? `${article.title} — wiki article` : 'Wiki article'}
      >
        <div className="character-modal-header">
          {isLoading ? (
            <h2 style={{ color: 'var(--text-muted)' }}>Loading…</h2>
          ) : article ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>{article.title}</h2>
              <span className="wiki-category-badge" style={{ color: catColor }}>{catLabel}</span>
              {article.is_stub && <span className="wiki-stub-badge">Stub</span>}
            </div>
          ) : (
            <h2 style={{ color: 'var(--danger)' }}>Article not found</h2>
          )}
          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
            {article && (
              <Link
                to={`/campaigns/${campaignId}/wiki/${article.id}`}
                className="btn-ghost"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                onClick={onClose}
              >
                Open ↗
              </Link>
            )}
            <button className="btn-icon" onClick={onClose} type="button" title="Close">✕</button>
          </div>
        </div>

        {article && (
          <div className="wiki-modal-body">
            {article.is_stub && (
              <div className="wiki-stub-banner" style={{ marginBottom: '0.75rem' }}>
                This article is a stub — click <strong>Open ↗</strong> to fill it in.
              </div>
            )}

            {/* Right details column */}
            {(article.image_url || article.associations.length > 0 || (article.tags && article.tags.length > 0)) && (
              <div className="wiki-details-col wiki-details-col--modal">
                {article.image_url && (
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="wiki-article-image-thumb"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                )}

                {article.associations.length > 0 && (
                  <div className="wiki-assoc-panel">
                    <div className="wiki-assoc-panel-title">Associations</div>
                    <div className="wiki-assoc-chips">
                      {article.associations.map((assoc) => (
                        <button
                          key={assoc.id}
                          className="wiki-assoc-chip"
                          type="button"
                          style={{ cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => onNavigate?.(assoc.other_article_id)}
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
                            {assoc.direction === 'from' ? `→ ${assoc.association_label}` : `← ${assoc.association_label}`}
                          </span>
                        </button>
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
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No content yet.</p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
