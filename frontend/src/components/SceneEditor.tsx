import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Suggestion from '@tiptap/suggestion'
import { Markdown } from 'tiptap-markdown'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { SKILLS, SAVES } from '../constants/dnd'
import { FormattingToolbar } from './FormattingToolbar'
import { CheckLine } from './CheckLineExtension'
import { createWikiLinkExtension } from './WikiLinkExtension'

interface CheckSlashItem {
  type: 'skill' | 'save'
  subtype: string
  label: string
}

interface WikiSlashItem {
  type: 'wiki'
  articleId: number
  label: string
  category: string
}

type AnySlashItem = CheckSlashItem | WikiSlashItem

// Public interface: only check items bubble up to the parent
interface SlashItem {
  type: 'skill' | 'save'
  subtype: string
  label: string
}

interface WikiArticleRef {
  id: number
  title: string
  category: string
}

const ALL_CHECK_ITEMS: CheckSlashItem[] = [
  ...SKILLS.map((s) => ({ type: 'skill' as const, subtype: s.key, label: s.name })),
  ...SAVES.map((s) => ({ type: 'save' as const, subtype: s.key, label: s.name })),
]

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

function getCheckTitle(item: CheckSlashItem): string {
  if (item.type === 'skill') {
    const sub = item.subtype.replace(/_/g, ' ')
    return `${sub.charAt(0).toUpperCase() + sub.slice(1)} Check`
  } else {
    const sub = item.subtype.replace(/_save$/, '').replace(/_/g, ' ')
    return `${sub.charAt(0).toUpperCase() + sub.slice(1)} Save`
  }
}

// ---------------------------------------------------------------------------
// Slash command list
// ---------------------------------------------------------------------------

interface SlashCommandListProps {
  items: AnySlashItem[]
  command: (item: AnySlashItem) => void
}

interface SlashCommandListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const SlashCommandList = forwardRef<SlashCommandListHandle, SlashCommandListProps>(
  function SlashCommandList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: SuggestionKeyDownProps): boolean {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) command(items[selectedIndex])
          return true
        }
        if (event.key === 'Escape') return true
        return false
      },
    }))

    return (
      <div className="slash-menu">
        {items.slice(0, 20).map((item, index) => (
          <button
            key={item.type === 'wiki' ? `wiki-${item.articleId}` : `${item.type}-${item.subtype}`}
            className={`slash-menu-item${index === selectedIndex ? ' selected' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              command(item)
            }}
            type="button"
          >
            {item.type === 'wiki'
              ? <><span className="slash-menu-wiki-icon">📖</span> {item.label}</>
              : item.type === 'skill'
              ? <>⚠️ {item.label}</>
              : <>🔴 {item.label}</>}
          </button>
        ))}
        {items.length === 0 && <div className="slash-menu-empty">No matches</div>}
      </div>
    )
  },
)

// ---------------------------------------------------------------------------
// Popup state
// ---------------------------------------------------------------------------

interface SlashPopup {
  items: AnySlashItem[]
  command: (item: AnySlashItem) => void
  rect: DOMRect
}

// ---------------------------------------------------------------------------
// SceneEditor
// ---------------------------------------------------------------------------

interface Props {
  content: string
  onSave: (md: string) => void
  onSelectSlashItem: (item: SlashItem, insertLine: () => void) => void
  wikiArticles?: WikiArticleRef[]
  onWikiLinkClick?: (articleId: number, title: string) => void
}

export function SceneEditor({ content, onSave, onSelectSlashItem, wikiArticles = [], onWikiLinkClick }: Props) {
  const [isFocused, setIsFocused] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  const onSelectRef = useRef(onSelectSlashItem)
  const wikiArticlesRef = useRef(wikiArticles)
  const onWikiClickRef = useRef<((articleId: number, title: string) => void) | null>(onWikiLinkClick ?? null)

  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { onSelectRef.current = onSelectSlashItem }, [onSelectSlashItem])
  useEffect(() => { wikiArticlesRef.current = wikiArticles }, [wikiArticles])
  useEffect(() => { onWikiClickRef.current = onWikiLinkClick ?? null }, [onWikiLinkClick])

  const [slashPopup, setSlashPopup] = useState<SlashPopup | null>(null)
  const setSlashRef = useRef(setSlashPopup)
  const slashListRef = useRef<SlashCommandListHandle>(null)

  const handleDebouncedSave = useCallback((md: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      onSaveRef.current(md)
    }, 600)
  }, [])

  const extensions = useMemo(() => {
    const SlashCommand = Extension.create({
      name: 'slashCommand',
      addProseMirrorPlugins() {
        return [
          Suggestion<AnySlashItem>({
            editor: this.editor as Editor,
            char: '/',
            command({
              editor: ed,
              range,
              props: item,
            }: {
              editor: Editor
              range: { from: number; to: number }
              props: AnySlashItem
            }) {
              ed.chain().focus().deleteRange(range).run()

              if (item.type === 'wiki') {
                // Insert inline wiki link node directly — no parent callback needed
                ed.chain().insertContent({
                  type: 'wikiLink',
                  attrs: {
                    articleId: item.articleId,
                    articleTitle: item.label,
                    articleCategory: item.category,
                  },
                }).run()
                return
              }

              // skill / save: bubble up to parent
              const title = getCheckTitle(item)
              const insertLine = () => {
                ed.chain().insertContent({
                  type: 'checkLine',
                  attrs: { checkType: item.type, title },
                }).run()
              }
              onSelectRef.current(item, insertLine)
            },
            items({ query }: { query: string }): AnySlashItem[] {
              const q = query.toLowerCase()
              // Wiki items: prefix-match on "wiki" or fuzzy-match article titles
              const isWikiQuery = 'wiki'.startsWith(q) || q.startsWith('wiki')
              const wikiQuery = q.startsWith('wiki') ? q.slice(4).trim() : ''

              const wikiItems: WikiSlashItem[] = isWikiQuery
                ? wikiArticlesRef.current
                    .filter((a) => !wikiQuery || fuzzyMatch(wikiQuery, a.title))
                    .map((a) => ({ type: 'wiki', articleId: a.id, label: a.title, category: a.category }))
                : []

              const checkItems: CheckSlashItem[] = ALL_CHECK_ITEMS.filter(
                (item) => fuzzyMatch(query, item.label) || fuzzyMatch(query, item.subtype),
              )

              return [...wikiItems, ...checkItems]
            },
            render() {
              return {
                onStart(props: SuggestionProps<AnySlashItem>) {
                  const rect = props.clientRect?.() ?? null
                  if (!rect) return
                  setSlashRef.current({
                    items: props.items,
                    command: (item) => props.command(item),
                    rect,
                  })
                },
                onUpdate(props: SuggestionProps<AnySlashItem>) {
                  const rect = props.clientRect?.() ?? null
                  setSlashRef.current((prev) =>
                    prev
                      ? {
                          ...prev,
                          items: props.items,
                          command: (item) => props.command(item),
                          ...(rect ? { rect } : {}),
                        }
                      : null,
                  )
                },
                onKeyDown(props: SuggestionKeyDownProps): boolean {
                  if (props.event.key === 'Escape') {
                    setSlashRef.current(null)
                    return true
                  }
                  return slashListRef.current?.onKeyDown(props) ?? false
                },
                onExit() {
                  setSlashRef.current(null)
                },
              }
            },
          }),
        ]
      },
    })

    return [
      StarterKit,
      CheckLine,
      createWikiLinkExtension(onWikiClickRef),
      Markdown,
      Placeholder.configure({
        placeholder: 'Click to write scene content… Type / to add a skill check, saving throw, or wiki link',
      }),
      SlashCommand,
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const editor = useEditor({
    extensions,
    content: content || '',
    onUpdate({ editor: ed }) {
      const md: string = (ed.storage.markdown as { getMarkdown: () => string }).getMarkdown()
      handleDebouncedSave(md)
    },
    onFocus() { setIsFocused(true) },
    onBlur() { setIsFocused(false) },
  })

  useEffect(() => {
    if (!editor) return
    const currentMd: string = (editor.storage.markdown as { getMarkdown: () => string }).getMarkdown()
    if (content !== currentMd) {
      editor.commands.setContent(content || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return (
    <div className="scene-editor">
      {editor && isFocused && <FormattingToolbar editor={editor} />}
      <EditorContent editor={editor} className="tiptap-editor" />
      {slashPopup &&
        createPortal(
          <div
            className="slash-menu-portal"
            style={{
              position: 'fixed',
              top: slashPopup.rect.bottom + 8,
              left: slashPopup.rect.left,
              zIndex: 9999,
            }}
          >
            <SlashCommandList
              ref={slashListRef}
              items={slashPopup.items}
              command={slashPopup.command}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
