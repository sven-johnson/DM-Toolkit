import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignId } from '../context/CampaignContext'
import {
  CATEGORY_COLORS,
  LOCATION_HIERARCHY,
  LOCATION_SUBTYPE_INDEX,
  type LocationSubtype,
} from '../constants/wiki'
import { useLocationArticles } from '../hooks/useWiki'
import type { WikiArticleDetail } from '../types'

// ---------------------------------------------------------------------------
// Tree-building logic
// ---------------------------------------------------------------------------

interface TreeNode {
  article: WikiArticleDetail
  children: TreeNode[]
}

function collectSubtreeIds(node: TreeNode, out: Set<string>): void {
  out.add(node.article.id)
  for (const child of node.children) {
    collectSubtreeIds(child, out)
  }
}

function buildNode(
  article: WikiArticleDetail,
  byId: Map<string, WikiArticleDetail>,
  visited: Set<string>,
): TreeNode {
  const subtype = article.location_subtype as LocationSubtype | null
  if (!subtype) return { article, children: [] }

  const myLevel = LOCATION_SUBTYPE_INDEX[subtype]
  if (myLevel === undefined) return { article, children: [] }

  const childLevelInfo = myLevel < LOCATION_HIERARCHY.length - 1
    ? LOCATION_HIERARCHY[myLevel + 1]
    : null
  if (!childLevelInfo) return { article, children: [] }

  const children: TreeNode[] = []
  const assocs = article.associations ?? []

  for (const assoc of assocs) {
    if (
      assoc.direction === 'from' &&
      assoc.association_label === childLevelInfo.childLabel &&
      assoc.other_article_category === 'location'
    ) {
      const child = byId.get(assoc.other_article_id)
      if (
        child &&
        child.location_subtype === childLevelInfo.subtype &&
        !visited.has(child.id)
      ) {
        visited.add(child.id)
        children.push(buildNode(child, byId, visited))
      }
    }
  }

  children.sort((a, b) => a.article.title.localeCompare(b.article.title))
  return { article, children }
}

function buildLocationTree(articles: WikiArticleDetail[]): {
  roots: TreeNode[]
  orphans: WikiArticleDetail[]
} {
  const byId = new Map<string, WikiArticleDetail>(articles.map((a) => [a.id, a]))
  const inTreeIds = new Set<string>()

  const roots: TreeNode[] = []

  for (const article of articles) {
    if (article.location_subtype === 'world') {
      const visited = new Set<string>([article.id])
      const node = buildNode(article, byId, visited)
      roots.push(node)
      collectSubtreeIds(node, inTreeIds)
    }
  }

  roots.sort((a, b) => a.article.title.localeCompare(b.article.title))

  const orphans = articles
    .filter((a) => !inTreeIds.has(a.id))
    .sort((a, b) => a.title.localeCompare(b.title))

  return { roots, orphans }
}

// ---------------------------------------------------------------------------
// Tree node component
// ---------------------------------------------------------------------------

interface TreeNodeViewProps {
  node: TreeNode
  depth: number
}

function TreeNodeView({ node, depth }: TreeNodeViewProps) {
  const [collapsed, setCollapsed] = useState(false)
  const hasChildren = node.children.length > 0
  const subtype = node.article.location_subtype as LocationSubtype | null
  const levelInfo = subtype ? LOCATION_HIERARCHY.find((l) => l.subtype === subtype) : null

  return (
    <div style={{ marginLeft: depth > 0 ? '1.25rem' : 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0',
          borderBottom: depth === 0 ? '1px solid var(--border)' : 'none',
          marginBottom: depth === 0 ? '0.1rem' : 0,
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="btn-icon"
            style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', minWidth: '1.4rem', color: 'var(--text-muted)' }}
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span style={{ display: 'inline-block', minWidth: '1.4rem' }} />
        )}

        {levelInfo && (
          <span
            style={{
              fontSize: '0.65rem',
              color: CATEGORY_COLORS['location'],
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              flexShrink: 0,
              minWidth: '7rem',
            }}
          >
            {levelInfo.label}
          </span>
        )}

        <Link
          to={`/wiki/${node.article.id}`}
          style={{
            fontWeight: depth === 0 ? 600 : 500,
            fontSize: depth === 0 ? '1rem' : '0.9rem',
            color: 'var(--text-heading)',
            flex: 1,
          }}
        >
          {node.article.title}
          {node.article.is_stub && (
            <span className="wiki-stub-badge" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>
              stub
            </span>
          )}
        </Link>

        {hasChildren && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {node.children.length}
          </span>
        )}
      </div>

      {!collapsed && hasChildren && (
        <div style={{ borderLeft: '2px solid var(--border)', marginLeft: '0.65rem', paddingLeft: '0.1rem' }}>
          {node.children.map((child) => (
            <TreeNodeView key={child.article.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function LocationsPage() {
  const campaignId = useCampaignId()
  const { data: locationArticles, isLoading } = useLocationArticles(campaignId!)
  const [orphansCollapsed, setOrphansCollapsed] = useState(false)

  const { roots, orphans } = useMemo(
    () => buildLocationTree(locationArticles ?? []),
    [locationArticles],
  )

  if (isLoading) return <div className="status-text">Loading locations…</div>

  const articles = locationArticles ?? []

  return (
    <div className="page">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>Locations</h1>
        <Link to="/wiki/new" className="btn-primary" style={{ fontSize: '0.875rem' }}>
          + New Location
        </Link>
      </div>

      {articles.length === 0 && (
        <p className="empty-state">
          No location articles yet.{' '}
          <Link to="/wiki/new" style={{ color: 'var(--accent)' }}>
            Create one
          </Link>{' '}
          and set its category to <strong>Location</strong>.
        </p>
      )}

      {roots.length > 0 && (
        <div style={{ maxWidth: 720, marginBottom: '2rem' }}>
          {roots.map((root) => (
            <div key={root.article.id} style={{ marginBottom: '1.5rem' }}>
              <TreeNodeView node={root} depth={0} />
            </div>
          ))}
        </div>
      )}

      {orphans.length > 0 && (
        <div style={{ maxWidth: 720 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderBottom: '2px solid var(--border)',
              paddingBottom: '0.4rem',
              marginBottom: '0.5rem',
              cursor: 'pointer',
            }}
            onClick={() => setOrphansCollapsed((c) => !c)}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {orphansCollapsed ? '▶' : '▼'}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Other Locations
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ({orphans.length})
            </span>
          </div>

          {!orphansCollapsed && (
            <div>
              {orphans.map((article) => {
                const subtype = article.location_subtype as LocationSubtype | null
                const levelInfo = subtype ? LOCATION_HIERARCHY.find((l) => l.subtype === subtype) : null
                return (
                  <div
                    key={article.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0' }}
                  >
                    <span style={{ display: 'inline-block', minWidth: '1.4rem' }} />
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: levelInfo ? CATEGORY_COLORS['location'] : 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontWeight: 600,
                        flexShrink: 0,
                        minWidth: '7rem',
                      }}
                    >
                      {levelInfo ? levelInfo.label : 'Unspecified'}
                    </span>
                    <Link
                      to={`/wiki/${article.id}`}
                      style={{ fontWeight: 500, color: 'var(--text-heading)', fontSize: '0.9rem', flex: 1 }}
                    >
                      {article.title}
                      {article.is_stub && (
                        <span className="wiki-stub-badge" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>
                          stub
                        </span>
                      )}
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
