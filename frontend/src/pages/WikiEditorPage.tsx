import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MarkdownBody } from '../components/MarkdownBody'
import { CATEGORY_COLORS, CATEGORY_LABELS, WIKI_CATEGORIES, type WikiCategory } from '../constants/wiki'
import {
  useAddWikiAssociation,
  useCreateWikiArticle,
  useDeleteWikiAssociation,
  useUpdateWikiArticle,
  useWikiArticle,
  useWikiArticles,
} from '../hooks/useWiki'

export function WikiEditorPage() {
  const { campaignId: campaignIdStr, articleId: articleIdStr } = useParams<{
    campaignId: string
    articleId?: string
  }>()
  const campaignId = Number(campaignIdStr)
  const articleId = articleIdStr ? Number(articleIdStr) : undefined
  const isEditing = articleId !== undefined
  const navigate = useNavigate()

  const { data: article, isLoading } = useWikiArticle(articleId)
  const { data: allArticles = [] } = useWikiArticles(campaignId)

  // Form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [isStub, setIsStub] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [publicContent, setPublicContent] = useState('')
  const [privateContent, setPrivateContent] = useState('')
  const [previewPublic, setPreviewPublic] = useState(false)
  const [previewPrivate, setPreviewPrivate] = useState(false)

  // Association add state
  const [assocTitle, setAssocTitle] = useState('')
  const [assocCategory, setAssocCategory] = useState('other')
  const [assocLabel, setAssocLabel] = useState('')

  const createArticle = useCreateWikiArticle(campaignId)
  const updateArticle = useUpdateWikiArticle(campaignId)
  const addAssociation = useAddWikiAssociation(articleId ?? 0, campaignId)
  const deleteAssociation = useDeleteWikiAssociation(articleId ?? 0, campaignId)

  // Pre-fill form when editing
  useEffect(() => {
    if (article) {
      setTitle(article.title)
      setCategory(article.category)
      setIsStub(article.is_stub)
      setImageUrl(article.image_url ?? '')
      setTagsInput(article.tags?.join(', ') ?? '')
      setPublicContent(article.public_content)
      setPrivateContent(article.private_content)
    }
  }, [article])

  const titleMatchInCampaign = allArticles.find(
    (a) => a.title.toLowerCase() === assocTitle.trim().toLowerCase() && a.id !== articleId,
  )
  const willCreateStub = assocTitle.trim() !== '' && !titleMatchInCampaign

  function buildTags(): string[] | null {
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    return tags.length > 0 ? tags : null
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      title: title.trim(),
      category,
      is_stub: isStub,
      image_url: imageUrl.trim() || null,
      tags: buildTags(),
      public_content: publicContent,
      private_content: privateContent,
    }
    if (isEditing && articleId !== undefined) {
      updateArticle.mutate(
        { id: articleId, ...payload },
        { onSuccess: () => navigate(`/campaigns/${campaignId}/wiki/${articleId}`) },
      )
    } else {
      createArticle.mutate(
        { ...payload, campaign_id: campaignId },
        { onSuccess: (created) => navigate(`/campaigns/${campaignId}/wiki/${created.id}`) },
      )
    }
  }

  function handleAddAssociation(e: React.FormEvent) {
    e.preventDefault()
    if (!assocTitle.trim() || !assocLabel.trim() || !articleId) return
    addAssociation.mutate(
      {
        target_title: assocTitle.trim(),
        target_category: willCreateStub ? assocCategory : (titleMatchInCampaign?.category ?? 'other'),
        association_label: assocLabel.trim(),
      },
      {
        onSuccess: () => {
          setAssocTitle('')
          setAssocCategory('other')
          setAssocLabel('')
        },
      },
    )
  }

  if (isEditing && isLoading) return <div className="status-text">Loading…</div>

  const saving = createArticle.isPending || updateArticle.isPending

  return (
    <div className="page">
      <div className="page-header">
        <Link
          to={isEditing ? `/campaigns/${campaignId}/wiki/${articleId}` : `/campaigns/${campaignId}/wiki`}
          className="nav-link"
          style={{ fontSize: '0.875rem' }}
        >
          ← {isEditing ? 'Article' : 'Wiki'}
        </Link>
        <h1 style={{ margin: 0 }}>{isEditing ? 'Edit Article' : 'New Article'}</h1>
      </div>

      <form onSubmit={handleSave} style={{ maxWidth: 760 }}>
        {/* Title + Category row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div className="wiki-editor-field">
            <label className="wiki-editor-label">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
              required
            />
          </div>
          <div className="wiki-editor-field">
            <label className="wiki-editor-label">Category</label>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {WIKI_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Image URL */}
        <div className="wiki-editor-field">
          <label className="wiki-editor-label">Image URL</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="wiki-editor-field">
          <label className="wiki-editor-label">Tags (comma-separated)</label>
          <input
            className="input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="player, druid, Chapter 1"
          />
          {buildTags() && (
            <div className="wiki-card-tags" style={{ marginTop: '0.25rem' }}>
              {buildTags()!.map((t) => (
                <span key={t} className="wiki-card-tag">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Is Stub */}
        <div className="wiki-editor-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id="is-stub"
            checked={isStub}
            onChange={(e) => setIsStub(e.target.checked)}
          />
          <label htmlFor="is-stub" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Mark as stub (placeholder article)
          </label>
        </div>

        {/* Public content */}
        <div className="wiki-content-section">
          <div className="wiki-content-header">
            <span className="wiki-editor-label">Public Content</span>
            <button
              className="btn-ghost"
              type="button"
              style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}
              onClick={() => setPreviewPublic((p) => !p)}
            >
              {previewPublic ? 'Edit' : 'Preview'}
            </button>
          </div>
          {previewPublic ? (
            <div className="wiki-content-preview">
              {publicContent ? <MarkdownBody content={publicContent} /> : <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing to preview.</span>}
            </div>
          ) : (
            <textarea
              className="input wiki-content-textarea"
              value={publicContent}
              onChange={(e) => setPublicContent(e.target.value)}
              placeholder="Markdown content visible to players…"
            />
          )}
        </div>

        {/* Private content */}
        <div className="wiki-private-content-section">
          <div className="wiki-content-header">
            <span className="wiki-editor-label" style={{ color: '#c8821e' }}>Private Content (DM Only)</span>
            <button
              className="btn-ghost"
              type="button"
              style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}
              onClick={() => setPreviewPrivate((p) => !p)}
            >
              {previewPrivate ? 'Edit' : 'Preview'}
            </button>
          </div>
          {previewPrivate ? (
            <div className="wiki-content-preview">
              {privateContent ? <MarkdownBody content={privateContent} /> : <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing to preview.</span>}
            </div>
          ) : (
            <textarea
              className="input wiki-content-textarea"
              value={privateContent}
              onChange={(e) => setPrivateContent(e.target.value)}
              placeholder="Private DM notes, secrets, plot hooks…"
            />
          )}
        </div>

        {/* Save actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
          <button className="btn-primary" type="submit" disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Article'}
          </button>
          <Link
            to={isEditing ? `/campaigns/${campaignId}/wiki/${articleId}` : `/campaigns/${campaignId}/wiki`}
            className="btn-ghost"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Association manager — only available when editing */}
      {isEditing && article ? (
        <div className="wiki-assoc-manager" style={{ maxWidth: 760 }}>
          <div className="wiki-assoc-manager-title">Associations</div>

          {article.associations.length > 0 ? (
            <div>
              {article.associations.map((assoc) => (
                <div key={assoc.id} className="wiki-assoc-row">
                  <span
                    className="wiki-category-badge"
                    style={{ color: CATEGORY_COLORS[assoc.other_article_category as WikiCategory] ?? '#888', flexShrink: 0 }}
                  >
                    {CATEGORY_LABELS[assoc.other_article_category as WikiCategory] ?? assoc.other_article_category}
                  </span>
                  <Link
                    to={`/campaigns/${campaignId}/wiki/${assoc.other_article_id}`}
                    style={{ fontWeight: 500, color: 'var(--text-heading)', flex: 1, fontSize: '0.9rem' }}
                  >
                    {assoc.other_article_title}
                  </Link>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {assoc.direction === 'from' ? `→ ${assoc.association_label}` : `← ${assoc.association_label}`}
                  </span>
                  <button
                    className="btn-icon btn-danger"
                    type="button"
                    onClick={() => deleteAssociation.mutate(assoc.id)}
                    disabled={deleteAssociation.isPending}
                    title="Remove association"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.5rem' }}>
              No associations yet.
            </p>
          )}

          <form className="wiki-add-assoc" onSubmit={handleAddAssociation}>
            <div className="wiki-add-assoc-row">
              <div style={{ flex: 2, minWidth: 120 }}>
                <input
                  className="input"
                  placeholder="Target article title"
                  value={assocTitle}
                  onChange={(e) => setAssocTitle(e.target.value)}
                  list="wiki-article-titles"
                  autoComplete="off"
                />
                <datalist id="wiki-article-titles">
                  {allArticles
                    .filter((a) => a.id !== articleId)
                    .map((a) => (
                      <option key={a.id} value={a.title} />
                    ))}
                </datalist>
              </div>
              <div style={{ flex: 2, minWidth: 120 }}>
                <input
                  className="input"
                  placeholder="Label (e.g. lives in)"
                  value={assocLabel}
                  onChange={(e) => setAssocLabel(e.target.value)}
                />
              </div>
              <button
                className="btn-primary btn-sm"
                type="submit"
                disabled={!assocTitle.trim() || !assocLabel.trim() || addAssociation.isPending}
              >
                Add
              </button>
            </div>
            {willCreateStub && assocTitle.trim() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span className="wiki-stub-hint">Will create stub:</span>
                <select
                  className="input"
                  style={{ width: 130, fontSize: '0.8rem', padding: '0.15rem 0.3rem' }}
                  value={assocCategory}
                  onChange={(e) => setAssocCategory(e.target.value)}
                >
                  {WIKI_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            )}
            {addAssociation.isError && (
              <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                Failed to add association.
              </p>
            )}
          </form>
        </div>
      ) : !isEditing ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 760 }}>
          Save the article first to manage associations.
        </p>
      ) : null}
    </div>
  )
}
