import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MarkdownBody } from '../components/MarkdownBody'
import { CATEGORY_COLORS, CATEGORY_LABELS, type WikiCategory } from '../constants/wiki'
import { exportWikiArticle, useDeleteWikiArticle, useWikiArticle } from '../hooks/useWiki'

export function WikiArticlePage() {
  const { campaignId: campaignIdStr, articleId: articleIdStr } = useParams<{
    campaignId: string
    articleId: string
  }>()
  const campaignId = Number(campaignIdStr)
  const articleId = Number(articleIdStr)
  const navigate = useNavigate()

  const { data: article, isLoading } = useWikiArticle(articleId)
  const deleteArticle = useDeleteWikiArticle(campaignId)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (!article) return
    setExporting(true)
    try {
      await exportWikiArticle(articleId, article.title)
    } finally {
      setExporting(false)
    }
  }

  function handleDelete() {
    deleteArticle.mutate(articleId, {
      onSuccess: () => navigate(`/campaigns/${campaignId}/wiki`),
    })
  }

  if (isLoading) return <div className="status-text">Loading…</div>
  if (!article) return <div className="status-text">Article not found.</div>

  const catColor = CATEGORY_COLORS[article.category as WikiCategory] ?? '#888'
  const catLabel = CATEGORY_LABELS[article.category as WikiCategory] ?? article.category

  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link
          to={`/campaigns/${campaignId}/wiki`}
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
          <Link
            to={`/campaigns/${campaignId}/wiki/${articleId}/edit`}
            className="btn-ghost"
          >
            Edit
          </Link>
          {deleteConfirm ? (
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
          )}
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
          {article.is_stub && <span className="wiki-stub-badge">Stub</span>}
        </div>

        {article.image_url && (
          <img
            src={article.image_url}
            alt={article.title}
            className="wiki-article-image"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}

        {article.associations.length > 0 && (
          <div className="wiki-assoc-panel">
            <div className="wiki-assoc-panel-title">Associations</div>
            <div className="wiki-assoc-chips">
              {article.associations.map((assoc) => (
                <Link
                  key={assoc.id}
                  to={`/campaigns/${campaignId}/wiki/${assoc.other_article_id}`}
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
