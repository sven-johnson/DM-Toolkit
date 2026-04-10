import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CATEGORY_COLORS, CATEGORY_LABELS, WIKI_CATEGORIES, type WikiCategory } from '../constants/wiki'
import { exportWikiAll, useImportWiki, useWikiArticles } from '../hooks/useWiki'
import type { WikiArticle, WikiImportRequest } from '../types'

// ---------------------------------------------------------------------------
// WikiCategorySection — defined outside WikiListPage to avoid remount on render
// ---------------------------------------------------------------------------

interface WikiCategorySectionProps {
  category: WikiCategory
  articles: WikiArticle[]
  campaignId: number
  collapsed: boolean
  onToggle: () => void
}

function WikiCategorySection({ category, articles, campaignId, collapsed, onToggle }: WikiCategorySectionProps) {
  const color = CATEGORY_COLORS[category]
  const label = CATEGORY_LABELS[category]

  return (
    <div className="wiki-category-section">
      <div
        className="wiki-category-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
        aria-expanded={!collapsed}
        style={{ borderColor: color }}
      >
        <span className="wiki-category-header-label" style={{ color }}>
          {label}
        </span>
        <span className="wiki-category-header-count">{articles.length}</span>
        <span className="wiki-category-header-chevron" style={{ color }}>
          {collapsed ? '▶' : '▼'}
        </span>
      </div>

      {!collapsed && (
        <div className="wiki-grid">
          {articles.map((article) => (
            <Link
              key={article.id}
              to={`/campaigns/${campaignId}/wiki/${article.id}`}
              className="wiki-card"
            >
              {article.image_url && (
                <img
                  src={article.image_url}
                  alt=""
                  className="wiki-card-image"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="wiki-card-body">
                <div className="wiki-card-header">
                  <span className="wiki-card-title">{article.title}</span>
                  {article.is_stub && <span className="wiki-stub-badge">Stub</span>}
                </div>
                {article.tags && article.tags.length > 0 && (
                  <div className="wiki-card-tags">
                    {article.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="wiki-card-tag">{tag}</span>
                    ))}
                    {article.tags.length > 4 && (
                      <span className="wiki-card-tag">+{article.tags.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WikiListPage
// ---------------------------------------------------------------------------

export function WikiListPage() {
  const { campaignId: campaignIdStr } = useParams<{ campaignId: string }>()
  const campaignId = Number(campaignIdStr)
  const navigate = useNavigate()

  const [filterCategory, setFilterCategory] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterQ, setFilterQ] = useState('')
  const [hideStubs, setHideStubs] = useState(false)
  // Track which category sections are collapsed; default all expanded
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const { data: articles = [] } = useWikiArticles(campaignId, {
    category: filterCategory || undefined,
    tag: filterTag || undefined,
    q: filterQ || undefined,
    stubs: hideStubs ? false : undefined,
  })

  const importWiki = useImportWiki(campaignId)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function handleCategoryPill(cat: string) {
    setFilterCategory((prev) => (prev === cat ? '' : cat))
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text) as WikiImportRequest
      json.campaign_id = campaignId
      importWiki.mutate(json, {
        onSuccess: (result) => {
          const parts = [`Created: ${result.created}`, `Updated: ${result.updated}`]
          if (result.stubs_created) parts.push(`Stubs created: ${result.stubs_created}`)
          if (result.errors.length) parts.push(`Errors: ${result.errors.length}`)
          setImportResult(parts.join(' · '))
        },
        onError: () => {
          setImportResult('Import failed — check that the file is a valid wiki export.')
        },
      })
    } catch {
      setImportResult('Could not parse file as JSON.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleExportAll() {
    setExporting(true)
    try {
      await exportWikiAll(campaignId)
    } finally {
      setExporting(false)
    }
  }

  // Group articles by category, preserving WIKI_CATEGORIES order
  const grouped = WIKI_CATEGORIES.map((cat) => ({
    category: cat,
    articles: articles.filter((a) => a.category === cat),
  })).filter((g) => g.articles.length > 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Wiki</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            className="btn-ghost"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importWiki.isPending}
          >
            {importWiki.isPending ? 'Importing…' : 'Import JSON'}
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={handleExportAll}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export All'}
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={() => navigate(`/campaigns/${campaignId}/wiki/new`)}
          >
            + New Article
          </button>
        </div>
      </div>

      {importResult && (
        <p className="import-pdf-status" style={{ marginBottom: '0.75rem' }}>
          {importResult}
        </p>
      )}

      <div className="wiki-filter-bar">
        <div className="wiki-filter-pills">
          <button
            className={`wiki-filter-pill${filterCategory === '' ? ' active' : ''}`}
            type="button"
            onClick={() => setFilterCategory('')}
          >
            All
          </button>
          {WIKI_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`wiki-filter-pill${filterCategory === cat ? ' active' : ''}`}
              type="button"
              style={filterCategory === cat ? { borderColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat], background: `${CATEGORY_COLORS[cat]}18` } : {}}
              onClick={() => handleCategoryPill(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <div className="wiki-filter-row">
          <input
            className="input"
            style={{ flex: '1', minWidth: '120px', maxWidth: '260px' }}
            placeholder="Search titles…"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
          />
          <input
            className="input"
            style={{ width: '140px' }}
            placeholder="Filter by tag…"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={hideStubs}
              onChange={(e) => setHideStubs(e.target.checked)}
            />
            Hide stubs
          </label>
        </div>
      </div>

      {articles.length === 0 && (
        <p className="empty-state">No articles yet. Create one to get started.</p>
      )}

      <div className="wiki-sections">
        {grouped.map(({ category, articles: catArticles }) => (
          <WikiCategorySection
            key={category}
            category={category}
            articles={catArticles}
            campaignId={campaignId}
            collapsed={collapsedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
          />
        ))}
      </div>
    </div>
  )
}
