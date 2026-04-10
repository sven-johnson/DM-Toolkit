import { Node, mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { MarkdownSerializerState } from '@tiptap/pm/markdown'
import type { RefObject } from 'react'

/** Escape a string for safe embedding inside an HTML attribute (double-quoted). */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function createWikiLinkExtension(
  onClickRef: RefObject<((articleId: number, title: string) => void) | null>,
) {
  return Node.create({
    name: 'wikiLink',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
      return {
        articleId: {
          default: 0,
          parseHTML: (el) => Number(el.getAttribute('data-wiki-id') ?? 0),
          renderHTML: (attrs: { articleId: number }) => ({ 'data-wiki-id': String(attrs.articleId) }),
        },
        articleTitle: {
          default: '',
          parseHTML: (el) => el.getAttribute('data-wiki-title') ?? '',
          renderHTML: (attrs: { articleTitle: string }) => ({ 'data-wiki-title': attrs.articleTitle }),
        },
        articleCategory: {
          default: 'other',
          parseHTML: (el) => el.getAttribute('data-wiki-category') ?? 'other',
          renderHTML: (attrs: { articleCategory: string }) => ({ 'data-wiki-category': attrs.articleCategory }),
        },
      }
    },

    parseHTML() {
      return [{ tag: 'span[data-wiki-link]' }]
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'span',
        mergeAttributes({ 'data-wiki-link': '' }, HTMLAttributes),
        (HTMLAttributes as Record<string, string>)['data-wiki-title'] ?? '',
      ]
    },

    addNodeView() {
      return ({ node }: { node: ProseMirrorNode }) => {
        const attrs = node.attrs as { articleId: number; articleTitle: string; articleCategory: string }
        const dom = document.createElement('span')
        dom.setAttribute('contenteditable', 'false')
        dom.className = 'wiki-link-chip'
        dom.textContent = attrs.articleTitle
        dom.addEventListener('click', () => {
          onClickRef.current?.(attrs.articleId, attrs.articleTitle)
        })
        return { dom }
      }
    },

    addStorage() {
      return {
        markdown: {
          serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
            const attrs = node.attrs as { articleId: number; articleTitle: string; articleCategory: string }
            state.write(
              `<span data-wiki-link data-wiki-id="${attrs.articleId}" data-wiki-title="${escapeAttr(attrs.articleTitle)}" data-wiki-category="${escapeAttr(attrs.articleCategory)}">${escapeAttr(attrs.articleTitle)}</span>`,
            )
          },
          parse: {},
        },
      }
    },
  })
}
