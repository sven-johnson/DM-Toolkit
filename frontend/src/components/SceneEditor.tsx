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

interface SlashItem {
  type: 'skill' | 'save'
  subtype: string
  label: string
}

const ALL_SLASH_ITEMS: SlashItem[] = [
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

// ---------------------------------------------------------------------------
// Slash command list component
// ---------------------------------------------------------------------------

interface SlashCommandListProps {
  items: SlashItem[]
  command: (item: SlashItem) => void
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
        if (event.key === 'Escape') {
          return true
        }
        return false
      },
    }))

    return (
      <div className="slash-menu">
        {items.slice(0, 8).map((item, index) => (
          <button
            key={`${item.type}-${item.subtype}`}
            className={`slash-menu-item${index === selectedIndex ? ' selected' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              command(item)
            }}
            type="button"
          >
            {item.type === 'skill' ? '⚠️' : '🔴'} {item.label}
          </button>
        ))}
        {items.length === 0 && <div className="slash-menu-empty">No matches</div>}
      </div>
    )
  },
)

// ---------------------------------------------------------------------------
// Slash popup state stored in React state (no ReactRenderer needed)
// ---------------------------------------------------------------------------

interface SlashPopup {
  items: SlashItem[]
  command: (item: SlashItem) => void
  rect: DOMRect
}

// ---------------------------------------------------------------------------
// SceneEditor
// ---------------------------------------------------------------------------

interface Props {
  content: string
  onSave: (md: string) => void
  onSelectSlashItem: (item: SlashItem) => void
}

export function SceneEditor({ content, onSave, onSelectSlashItem }: Props) {
  const [isFocused, setIsFocused] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  const onSelectRef = useRef(onSelectSlashItem)

  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { onSelectRef.current = onSelectSlashItem }, [onSelectSlashItem])

  const [slashPopup, setSlashPopup] = useState<SlashPopup | null>(null)
  // Stable refs so the extension closure can always reach the latest values
  const setSlashRef = useRef(setSlashPopup)
  const slashListRef = useRef<SlashCommandListHandle>(null)

  const handleDebouncedSave = useCallback((md: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      onSaveRef.current(md)
    }, 600)
  }, [])

  // Build extensions once. All mutable state is reached through refs.
  const extensions = useMemo(() => {
    const SlashCommand = Extension.create({
      name: 'slashCommand',
      addProseMirrorPlugins() {
        return [
          Suggestion<SlashItem>({
            editor: this.editor as Editor,
            char: '/',
            command({
              editor: ed,
              range,
              props,
            }: {
              editor: Editor
              range: { from: number; to: number }
              props: SlashItem
            }) {
              ed.chain().focus().deleteRange(range).run()
              onSelectRef.current(props)
            },
            items({ query }: { query: string }): SlashItem[] {
              return ALL_SLASH_ITEMS.filter(
                (item) => fuzzyMatch(query, item.label) || fuzzyMatch(query, item.subtype),
              )
            },
            render() {
              return {
                onStart(props: SuggestionProps<SlashItem>) {
                  const rect = props.clientRect?.() ?? null
                  if (!rect) return
                  setSlashRef.current({
                    items: props.items,
                    command: (item) => props.command(item),
                    rect,
                  })
                },
                onUpdate(props: SuggestionProps<SlashItem>) {
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
      Markdown,
      Placeholder.configure({
        placeholder: 'Click to write scene content... Type / to add a skill check or saving throw',
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

  // Sync content when prop changes externally
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
