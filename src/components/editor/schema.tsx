'use client'

// The editor's block schema and Notion-style behaviour shared by every editor:
// extra blocks (callout, table of contents, page links, boards, columns),
// markdown shortcuts and a slash menu that ranks prefix matches first.

import { BlockNoteSchema, createExtension, defaultBlockSpecs, type BlockNoteEditor } from '@blocknote/core'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import { zhTW } from '@blocknote/core/locales'
import { getDefaultReactSlashMenuItems, type DefaultReactSuggestionItem } from '@blocknote/react'
import { getMultiColumnSlashMenuItems, withMultiColumn } from '@blocknote/xl-multi-column'
import { ArrowUpRight, FileText, Info, Kanban, ListBullets } from '@phosphor-icons/react'
import { BoardBlock } from './blocks/BoardBlock'
import { Callout } from './blocks/Callout'
import { PageLink } from './blocks/PageLink'
import { TableOfContents } from './blocks/TableOfContents'
import type { NoteEditorContext } from './NoteContext'

export const editorSchema = withMultiColumn(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      callout: Callout(),
      toc: TableOfContents(),
      pageLink: PageLink(),
      board: BoardBlock(),
    },
  }),
)

export type NoteEditor = typeof editorSchema.BlockNoteEditor

export const multiColumnDictionary = {
  slash_menu: {
    two_columns: { title: '兩欄', subtext: '左右並排兩欄', aliases: ['columns', '2 columns', '欄', '兩欄', '左右', '並排'], group: '進階' },
    three_columns: { title: '三欄', subtext: '並排三欄', aliases: ['columns', '3 columns', '欄', '三欄', '並排'], group: '進階' },
  },
}

/**
 * Notion's markdown shortcuts on top of BlockNote's:
 *   "> "          toggle list (a quote is `" `); in a heading it makes the heading collapsible
 *   "# " … "### " inside a toggle list keeps it collapsible as a heading
 */
export const notionShortcuts = createExtension({
  key: 'notion-shortcuts',
  runsBefore: ['quote-block-shortcuts', 'heading-shortcuts', 'toggle-list-item-shortcuts'],
  inputRules: [
    {
      find: /^>\s$/,
      replace({ editor }) {
        const block = editor.getTextCursorPosition().block
        if (block.type === 'heading') return { type: 'heading', props: { ...block.props, isToggleable: true } }
        return { type: 'toggleListItem', props: {} }
      },
    },
    {
      find: /^(#{1,3})\s$/,
      replace({ editor, match }) {
        const block = editor.getTextCursorPosition().block
        if (block.type !== 'toggleListItem') return undefined
        return { type: 'heading', props: { level: match[1].length as 1 | 2 | 3, isToggleable: true } }
      },
    },
  ],
})

/** Exact title/alias first, then prefix matches, then the rest (stable within each rank). */
export function rankItems<T extends { title: string; aliases?: readonly string[]; group?: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  const found = filterSuggestionItems(items, q)
  const rank = (item: T) => {
    const words = [item.title, ...(item.aliases ?? [])].map((w) => w.toLowerCase())
    if (words.includes(q)) return 0
    if (words.some((w) => w.startsWith(q))) return 1
    return 2
  }
  const ranked = found
    .map((item, i) => ({ item, i, r: q ? rank(item) : 0 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ item }) => item)
  // The menu draws one heading per group, so keep each group together
  // (groups ordered by their best match; the top match stays first).
  const groups = new Map<string, T[]>()
  for (const item of ranked) {
    const group = item.group ?? ''
    groups.set(group, [...(groups.get(group) ?? []), item])
  }
  return [...groups.values()].flat()
}

const icon = (Icon: typeof Info) => <Icon size={18} />

export function slashItems(editor: NoteEditor, note: NoteEditorContext | null): DefaultReactSuggestionItem[] {
  const anyEditor = editor as unknown as BlockNoteEditor
  const items: DefaultReactSuggestionItem[] = [
    ...getDefaultReactSlashMenuItems(anyEditor),
    {
      key: 'callout',
      title: '標註',
      subtext: '用圖示和底色凸顯一段話',
      aliases: ['callout', 'note', 'tip', '標註', '提示', '注意'],
      group: '基礎',
      icon: icon(Info),
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'callout' }),
    } as DefaultReactSuggestionItem,
    {
      key: 'toc',
      title: '目錄',
      subtext: '列出這一頁的 H1–H3，點一下就跳過去',
      aliases: ['toc', 'table of contents', 'contents', '目錄', '大綱'],
      group: '進階',
      icon: icon(ListBullets),
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'toc' }),
    } as DefaultReactSuggestionItem,
    ...getMultiColumnSlashMenuItems(anyEditor),
  ]

  if (note) {
    items.push(
      {
        key: 'page',
        title: '頁面',
        subtext: '在這裡建立一個子頁面',
        aliases: ['page', 'subpage', '頁面', '子頁面', '新頁面'],
        group: '頁面與看板',
        icon: icon(FileText),
        onItemClick: () => {
          const placeholder = insertOrUpdateBlockForSlashMenu(editor, { type: 'pageLink', props: { pageId: 0, mode: 'child' } })
          void note.createChildPage().then((page) => {
            if (page) editor.updateBlock(placeholder.id, { props: { pageId: page.id } })
            else editor.removeBlocks([placeholder.id])
          })
        },
      } as DefaultReactSuggestionItem,
      {
        key: 'link_to_page',
        title: '連結到頁面',
        subtext: '連到任何筆記本裡的頁面',
        aliases: ['link', 'link to page', 'mention', '連結', '頁面連結', '連到'],
        group: '頁面與看板',
        icon: icon(ArrowUpRight),
        onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'pageLink', props: { pageId: 0, mode: 'link' } }),
      } as DefaultReactSuggestionItem,
      {
        key: 'board',
        title: '待辦看板',
        subtext: '像 Notion 資料庫：每張卡片都是一頁',
        aliases: ['board', 'todo', 'kanban', 'database', '看板', '待辦', '資料庫'],
        group: '頁面與看板',
        icon: icon(Kanban),
        onItemClick: () => {
          const placeholder = insertOrUpdateBlockForSlashMenu(editor, { type: 'board', props: { boardId: 0 } })
          void note.createBoard().then((board) => {
            if (board) editor.updateBlock(placeholder.id, { props: { boardId: board.id } })
            else editor.removeBlocks([placeholder.id])
          })
        },
      } as DefaultReactSuggestionItem,
    )
  }
  return items
}

export const editorDictionary = { ...zhTW, multi_column: multiColumnDictionary }
