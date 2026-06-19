import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignId } from '../context/CampaignContext'
import { MarkdownBody } from '../components/MarkdownBody'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  LOCATION_HIERARCHY,
  LOCATION_SUBTYPE_INDEX,
  WIKI_CATEGORIES,
  type LocationSubtype,
  type WikiCategory,
} from '../constants/wiki'
import {
  useAddWikiAssociation,
  useAddWikiAssociationAsTarget,
  useCreateWikiArticle,
  useDeleteWikiAssociation,
  useUpdateWikiArticle,
  useWikiArticle,
  useWikiArticles,
} from '../hooks/useWiki'
import apiClient from '../api/client'
import { getObjectKeyFromUrl } from '../lib/imageUrl'
import type { WikiAssociationDisplay } from '../types'

// ---------------------------------------------------------------------------
// Location hierarchy editor helpers
// ---------------------------------------------------------------------------

interface LocationHierarchyEditorProps {
  articleId: string
  campaignId: string
  subtype: LocationSubtype
  associations: WikiAssociationDisplay[]
  allArticles: { id: string; title: string; category: string; location_subtype: string | null }[]
}

function LocationHierarchyEditor({
  articleId,
  campaignId,
  subtype,
  associations,
  allArticles,
}: LocationHierarchyEditorProps) {
  const myLevel = LOCATION_SUBTYPE_INDEX[subtype]
  const addAsTarget = useAddWikiAssociationAsTarget(articleId, campaignId)
  const addChild = useAddWikiAssociation(articleId, campaignId)
  const deleteAssoc = useDeleteWikiAssociation(articleId, campaignId)

  // Inputs for each parent level
  const [parentInputs, setParentInputs] = useState<Record<string, string>>({})
  const [childInput, setChildInput] = useState('')

  // Parent levels: all levels above current
  const parentLevels = LOCATION_HIERARCHY.slice(0, myLevel)
  // Child level: one level below (if any)
  const childLevel = myLevel < LOCATION_HIERARCHY.length - 1 ? LOCATION_HIERARCHY[myLevel + 1] : null

  function getParentAssoc(parentSubtype: LocationSubtype) {
    // Parent is SOURCE of an incoming association with label = current article's childLabel
    const myChildLabel = LOCATION_HIERARCHY[myLevel].childLabel
    return associations.find(
      (a) =>
        a.direction === 'to' &&
        a.association_label === myChildLabel &&
        a.other_article_location_subtype === parentSubtype,
    )
  }

  function getChildAssocs() {
    if (!childLevel) return []
    return associations.filter(
      (a) => a.direction === 'from' && a.association_label === childLevel.childLabel,
    )
  }

  function handleAddParent(parentSubtype: LocationSubtype) {
    const value = parentInputs[parentSubtype]?.trim()
    if (!value) return
    const myChildLabel = LOCATION_HIERARCHY[myLevel].childLabel
    addAsTarget.mutate(
      {
        source_title: value,
        source_category: 'location',
        source_location_subtype: parentSubtype,
        association_label: myChildLabel,
      },
      { onSuccess: () => setParentInputs((prev) => ({ ...prev, [parentSubtype]: '' })) },
    )
  }

  function handleAddChild() {
    if (!childLevel || !childInput.trim()) return
    addChild.mutate(
      {
        target_title: childInput.trim(),
        target_category: 'location',
        target_location_subtype: childLevel.subtype,
        association_label: childLevel.childLabel,
      },
      { onSuccess: () => setChildInput('') },
    )
  }

  const childAssocs = getChildAssocs()

  return (
    <div className="wiki-assoc-manager" style={{ maxWidth: 760, marginTop: '0.5rem' }}>
      <div className="wiki-assoc-manager-title">Location Hierarchy</div>

      {/* Parent sections */}
      {parentLevels.map((level) => {
        const existing = getParentAssoc(level.subtype)
        const inputVal = parentInputs[level.subtype] ?? ''
        const locationArticles = allArticles.filter(
          (a) => a.category === 'location' && a.location_subtype === level.subtype && a.id !== articleId,
        )
        return (
          <div key={level.subtype} style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              {level.label}
            </div>
            {existing ? (
              <div className="wiki-assoc-row">
                <span
                  className="wiki-category-badge"
                  style={{ color: CATEGORY_COLORS['location'], flexShrink: 0 }}
                >
                  Location
                </span>
                <Link
                  to={`/wiki/${existing.other_article_id}`}
                  style={{ fontWeight: 500, color: 'var(--text-heading)', flex: 1, fontSize: '0.9rem' }}
                >
                  {existing.other_article_title}
                </Link>
                <button
                  className="btn-icon btn-danger"
                  type="button"
                  onClick={() => deleteAssoc.mutate(existing.id)}
                  disabled={deleteAssoc.isPending}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <input
                    className="input"
                    placeholder={`${level.label} name…`}
                    value={inputVal}
                    onChange={(e) =>
                      setParentInputs((prev) => ({ ...prev, [level.subtype]: e.target.value }))
                    }
                    list={`loc-parent-${level.subtype}`}
                    autoComplete="off"
                  />
                  <datalist id={`loc-parent-${level.subtype}`}>
                    {locationArticles.map((a) => (
                      <option key={a.id} value={a.title} />
                    ))}
                  </datalist>
                </div>
                <button
                  className="btn-primary btn-sm"
                  type="button"
                  disabled={!inputVal.trim() || addAsTarget.isPending}
                  onClick={() => handleAddParent(level.subtype)}
                >
                  Set
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Child section */}
      {childLevel && (
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            {childLevel.plural}
          </div>

          {childAssocs.map((assoc) => (
            <div key={assoc.id} className="wiki-assoc-row">
              <span
                className="wiki-category-badge"
                style={{ color: CATEGORY_COLORS['location'], flexShrink: 0 }}
              >
                Location
              </span>
              <Link
                to={`/wiki/${assoc.other_article_id}`}
                style={{ fontWeight: 500, color: 'var(--text-heading)', flex: 1, fontSize: '0.9rem' }}
              >
                {assoc.other_article_title}
              </Link>
              <button
                className="btn-icon btn-danger"
                type="button"
                onClick={() => deleteAssoc.mutate(assoc.id)}
                disabled={deleteAssoc.isPending}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
            <div style={{ flex: 1 }}>
              <input
                className="input"
                placeholder={`Add ${childLevel.label}…`}
                value={childInput}
                onChange={(e) => setChildInput(e.target.value)}
                list="loc-child-options"
                autoComplete="off"
              />
              <datalist id="loc-child-options">
                {allArticles
                  .filter((a) => a.category === 'location' && a.location_subtype === childLevel.subtype && a.id !== articleId)
                  .map((a) => (
                    <option key={a.id} value={a.title} />
                  ))}
              </datalist>
            </div>
            <button
              className="btn-primary btn-sm"
              type="button"
              disabled={!childInput.trim() || addChild.isPending}
              onClick={handleAddChild}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {addAsTarget.isError && (
        <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
          Failed to set parent location.
        </p>
      )}
      {addChild.isError && (
        <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
          Failed to add child location.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function WikiEditorPage() {
  const { articleId } = useParams<{ articleId?: string }>()
  const campaignId = useCampaignId()
  const isEditing = articleId !== undefined
  const navigate = useNavigate()

  const { data: article, isLoading } = useWikiArticle(articleId)
  const { data: allArticles = [] } = useWikiArticles(campaignId!)

  // Form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [locationSubtype, setLocationSubtype] = useState<string>('')
  const [isStub, setIsStub] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tagsInput, setTagsInput] = useState('')
  const [publicContent, setPublicContent] = useState('')
  const [privateContent, setPrivateContent] = useState('')
  const [previewPublic, setPreviewPublic] = useState(false)
  const [previewPrivate, setPreviewPrivate] = useState(false)

  // Association add state
  const [assocTitle, setAssocTitle] = useState('')
  const [assocCategory, setAssocCategory] = useState('other')
  const [assocLabel, setAssocLabel] = useState('')

  const createArticle = useCreateWikiArticle(campaignId!)
  const updateArticle = useUpdateWikiArticle(campaignId!)
  const addAssociation = useAddWikiAssociation(articleId ?? '', campaignId!)
  const deleteAssociation = useDeleteWikiAssociation(articleId ?? '', campaignId!)

  // Pre-fill form when editing
  useEffect(() => {
    if (article) {
      setTitle(article.title)
      setCategory(article.category)
      setLocationSubtype(article.location_subtype ?? '')
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

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setImageError(null)
    setImageUploading(true)
    try {
      if (imageUrl) {
        const oldKey = getObjectKeyFromUrl(imageUrl)
        if (oldKey) {
          await apiClient.delete(`/images/${oldKey}`)
        }
      }

      const form = new FormData()
      form.append('file', file)
      form.append('folder', 'wiki')
      const { data } = await apiClient.post<{ object_key: string; url: string }>('/images/', form)
      setImageUrl(data.url)
    } catch {
      setImageError('Upload failed — check the file type and try again.')
    } finally {
      setImageUploading(false)
    }
  }

  async function handleDeleteImage() {
    const key = getObjectKeyFromUrl(imageUrl)
    if (key) {
      try {
        await apiClient.delete(`/images/${key}`)
      } catch {
        // Non-fatal
      }
    }
    setImageUrl('')
    setImageError(null)
  }

  function buildTags(): string[] | null {
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    return tags.length > 0 ? tags : null
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      title: title.trim(),
      category,
      location_subtype: category === 'location' && locationSubtype ? locationSubtype : null,
      is_stub: isStub,
      image_url: imageUrl.trim() || null,
      tags: buildTags(),
      public_content: publicContent,
      private_content: privateContent,
    }
    if (isEditing && articleId !== undefined) {
      updateArticle.mutate(
        { id: articleId, ...payload },
        { onSuccess: () => navigate(`/wiki/${articleId}`) },
      )
    } else {
      createArticle.mutate(
        { ...payload, campaign_id: campaignId! },
        { onSuccess: (created) => navigate(`/wiki/${created.id}`) },
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

  // Determine if location hierarchy editor should show
  const showLocationHierarchy =
    isEditing &&
    article &&
    category === 'location' &&
    locationSubtype !== ''

  // Associations NOT managed by the location hierarchy editor
  const nonHierarchyAssociations = article?.associations.filter((a) => {
    if (!showLocationHierarchy) return true
    const myLevel = LOCATION_SUBTYPE_INDEX[locationSubtype as LocationSubtype]
    const myChildLabel = LOCATION_HIERARCHY[myLevel].childLabel
    // Exclude incoming parent links (direction=to, label=my childLabel, category=location)
    if (a.direction === 'to' && a.association_label === myChildLabel && a.other_article_category === 'location') return false
    // Exclude outgoing child links (direction=from, label=child level's childLabel, category=location)
    if (myLevel < LOCATION_HIERARCHY.length - 1) {
      const childChildLabel = LOCATION_HIERARCHY[myLevel + 1].childLabel
      if (a.direction === 'from' && a.association_label === childChildLabel && a.other_article_category === 'location') return false
    }
    return true
  }) ?? []

  return (
    <div className="page">
      <div className="page-header">
        <Link
          to={isEditing ? `/wiki/${articleId}` : `/wiki`}
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
              onChange={(e) => {
                setCategory(e.target.value)
                if (e.target.value !== 'location') setLocationSubtype('')
              }}
            >
              {WIKI_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Location subtype — only for location category */}
        {category === 'location' && (
          <div className="wiki-editor-field" style={{ marginBottom: '0.75rem' }}>
            <label className="wiki-editor-label">Location Type</label>
            <select
              className="input"
              value={locationSubtype}
              onChange={(e) => setLocationSubtype(e.target.value)}
            >
              <option value="">— unspecified —</option>
              {LOCATION_HIERARCHY.map((l) => (
                <option key={l.subtype} value={l.subtype}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Image upload */}
        <div className="wiki-editor-field">
          <label className="wiki-editor-label">Image</label>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleImageFileChange}
            />
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: '0.875rem' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
            >
              {imageUploading ? 'Uploading…' : imageUrl ? 'Replace Image' : 'Upload Image'}
            </button>
            {imageUrl && !imageUploading && (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.875rem', color: 'var(--danger)' }}
                onClick={handleDeleteImage}
              >
                Delete Image
              </button>
            )}
            {imageError && (
              <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{imageError}</span>
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
            to={isEditing ? `/wiki/${articleId}` : `/wiki`}
            className="btn-ghost"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Location Hierarchy Editor — only for location articles with a subtype */}
      {showLocationHierarchy && article && (
        <LocationHierarchyEditor
          articleId={articleId!}
          campaignId={campaignId!}
          subtype={locationSubtype as LocationSubtype}
          associations={article.associations}
          allArticles={allArticles}
        />
      )}

      {/* Association manager — only available when editing */}
      {isEditing && article ? (
        <div className="wiki-assoc-manager" style={{ maxWidth: 760 }}>
          <div className="wiki-assoc-manager-title">
            {showLocationHierarchy ? 'Other Associations' : 'Associations'}
          </div>

          {nonHierarchyAssociations.length > 0 ? (
            <div>
              {nonHierarchyAssociations.map((assoc) => (
                <div key={assoc.id} className="wiki-assoc-row">
                  <span
                    className="wiki-category-badge"
                    style={{ color: CATEGORY_COLORS[assoc.other_article_category as WikiCategory] ?? '#888', flexShrink: 0 }}
                  >
                    {CATEGORY_LABELS[assoc.other_article_category as WikiCategory] ?? assoc.other_article_category}
                  </span>
                  <Link
                    to={`/wiki/${assoc.other_article_id}`}
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
