import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor
}

export function FormattingToolbar({ editor }: Props) {
  return (
    <div className="formatting-toolbar">
      <button
        className={`toolbar-btn${editor.isActive('paragraph') ? ' active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().setParagraph().run()
        }}
        title="Paragraph"
        type="button"
      >
        P
      </button>
      <button
        className={`toolbar-btn${editor.isActive('heading', { level: 1 }) ? ' active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }}
        title="Heading 1"
        type="button"
      >
        H1
      </button>
      <button
        className={`toolbar-btn${editor.isActive('heading', { level: 2 }) ? ' active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }}
        title="Heading 2"
        type="button"
      >
        H2
      </button>
      <button
        className={`toolbar-btn${editor.isActive('heading', { level: 3 }) ? ' active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }}
        title="Heading 3"
        type="button"
      >
        H3
      </button>
      <button
        className={`toolbar-btn${editor.isActive('bold') ? ' active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleBold().run()
        }}
        title="Bold"
        type="button"
      >
        <strong>B</strong>
      </button>
      <button
        className={`toolbar-btn${editor.isActive('italic') ? ' active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleItalic().run()
        }}
        title="Italic"
        type="button"
      >
        <em>I</em>
      </button>
    </div>
  )
}
