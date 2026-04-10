import { Node, mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { MarkdownSerializerState } from '@tiptap/pm/markdown'

export const CheckLine = Node.create({
  name: 'checkLine',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      checkType: {
        default: 'skill',
        parseHTML: (el) => el.getAttribute('data-check-type') ?? 'skill',
        renderHTML: (attrs: { checkType: string }) => ({ 'data-check-type': attrs.checkType }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-check-title') ?? '',
        renderHTML: (attrs: { title: string }) => ({ 'data-check-title': attrs.title }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-check-line]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const title = (HTMLAttributes as Record<string, string>)['data-check-title'] ?? ''
    return ['div', mergeAttributes({ 'data-check-line': '' }, HTMLAttributes), title]
  },

  addNodeView() {
    return ({ node }: { node: ProseMirrorNode }) => {
      const dom = document.createElement('div')
      dom.setAttribute('contenteditable', 'false')
      const isSkill = (node.attrs as { checkType: string }).checkType === 'skill'
      dom.className = `check-line-block ${isSkill ? 'check-line-skill' : 'check-line-save'}`
      const strong = document.createElement('strong')
      strong.textContent = (node.attrs as { title: string }).title
      dom.appendChild(strong)
      return { dom }
    }
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: MarkdownSerializerState,
          node: ProseMirrorNode,
        ) {
          const attrs = node.attrs as { checkType: string; title: string }
          state.write(
            `<div data-check-line data-check-type="${attrs.checkType}" data-check-title="${attrs.title}">${attrs.title}</div>`,
          )
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
