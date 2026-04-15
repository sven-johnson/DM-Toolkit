import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../constants/wiki'
import { useWikiSearch } from '../hooks/useWiki'
import type { WikiArticle } from '../types'

interface Props {
  campaignId: number
  onSelect: (id: number, title: string, category: string) => void
  onClose: () => void
}

export function WikiExplorerModal({ campaignId, onSelect, onClose }: Props) {
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [creatingStub, setCreatingStub] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(rawQuery), 250)
    return () => clearTimeout(timer)
  }, [rawQuery])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const { data: results = [], isFetching } = useWikiSearch(campaignId, debouncedQuery)

  async function handleCreateStub() {
    const title = rawQuery.trim()
    if (!title || creatingStub) return
    setCreatingStub(true)
    try {
      const { data } = await apiClient.post<WikiArticle>('/wiki', {
        campaign_id: campaignId,
        title,
        category: 'other',
        is_stub: true,
        image_url: null,
        tags: [],
        public_content: '',
        private_content: '',
      })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
      onSelect(data.id, data.title, data.category)
    } finally {
      setCreatingStub(false)
    }
  }

  const categoryColor = (cat: string) =>
    CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] ?? 'var(--text-muted)'
  const categoryLabel = (cat: string) =>
    CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wiki-explorer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wiki-explorer-header">
          <h2 className="modal-title">Wiki Explorer</h2>
          <button className="wiki-explorer-close" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="wiki-explorer-search">
          <input
            ref={inputRef}
            className="input"
            placeholder="Search titles, tags, and content…"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
          />
        </div>

        <div className="wiki-explorer-results">
          {!debouncedQuery && (
            <div className="wiki-explorer-status">Type to search wiki articles…</div>
          )}
          {debouncedQuery && isFetching && (
            <div className="wiki-explorer-status">Searching…</div>
          )}
          {debouncedQuery && !isFetching && results.length === 0 && (
            <div className="wiki-explorer-status">No results for "{debouncedQuery}"</div>
          )}
          {results.map((article) => (
            <button
              key={article.id}
              type="button"
              className="wiki-explorer-result"
              onClick={() => onSelect(article.id, article.title, article.category)}
            >
              <div className="wiki-explorer-result-header">
                <span className="wiki-explorer-result-title">{article.title}</span>
                <span
                  className="wiki-category-badge"
                  style={{ color: categoryColor(article.category) }}
                >
                  {categoryLabel(article.category)}
                </span>
                {article.is_stub && <span className="wiki-stub-badge">Stub</span>}
              </div>
              {article.tags && article.tags.length > 0 && (
                <div className="wiki-explorer-result-tags">
                  {article.tags.slice(0, 3).map((t) => (
                    <span key={t} className="wiki-card-tag">{t}</span>
                  ))}
                  {article.tags.length > 3 && (
                    <span className="wiki-card-tag">+{article.tags.length - 3}</span>
                  )}
                </div>
              )}
              {article.snippet && (
                <div className="wiki-explorer-result-snippet">{article.snippet}</div>
              )}
            </button>
          ))}
        </div>

        <div className="wiki-explorer-footer">
          <button
            className="btn-ghost"
            type="button"
            onClick={handleCreateStub}
            disabled={!rawQuery.trim() || creatingStub}
          >
            {creatingStub ? 'Creating…' : '+ Create Stub'}
          </button>
        </div>
      </div>
    </div>
  )
}
