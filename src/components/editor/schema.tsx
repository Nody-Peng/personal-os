'use client'

// The editor's block schema and Notion-style behaviour shared by every editor:
// extra blocks (callout, table of contents, page links, boards, columns),
// markdown shortcuts and a slash menu that ranks prefix matches first.

import { BlockNoteSchema, createExtension, defaultBlockSpecs, type BlockNoteEditor } from '@blocknote/core'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu, SuggestionMenu } from '@blocknote/core/extensions'
import { zhTW } from '@blocknote/core/locales'
import { getDefaultReactSlashMenuItems, type DefaultReactSuggestionItem } from '@blocknote/react'
import { getMultiColumnSlashMenuItems, withMultiColumn } from '@blocknote/xl-multi-column'
import { ArrowUpRight, BookmarkSimple, FileText, FrameCorners, Info, Kanban, ListBullets } from '@phosphor-icons/react'
import { BoardBlock } from './blocks/BoardBlock'
import { BookmarkBlock } from './blocks/BookmarkBlock'
import { Callout } from './blocks/Callout'
import { CodeBlock } from './blocks/CodeBlock'
import { EmbedBlock } from './blocks/EmbedBlock'
import { PageLink } from './blocks/PageLink'
import { TableOfContents } from './blocks/TableOfContents'
import { freshIs, markFresh } from './blocks/freshBlock'
import { codeLanguageFor } from './codeLanguages'
import type { NoteEditorContext } from './NoteContext'
import { toggleEnter } from './toggleEnter'

export const editorSchema = withMultiColumn(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      codeBlock: CodeBlock(),
      callout: Callout(),
      toc: TableOfContents(),
      pageLink: PageLink(),
      board: BoardBlock(),
      bookmark: BookmarkBlock(),
      embed: EmbedBlock(),
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
 *   "``` " / "```python " code block (Bash when no language is given)
 * and Notion's Enter in a toggle (`toggleEnter`): its children stay with it.
 * Enter on an empty list item inside another moves it out a level (BlockNote
 * would turn it into an indented paragraph); at the top level it ends the list.
 */
export const notionShortcuts = createExtension({
  key: 'notion-shortcuts',
  runsBefore: [
    'quote-block-shortcuts',
    'heading-shortcuts',
    'toggle-list-item-shortcuts',
    'bullet-list-item-shortcuts',
    'numbered-list-item-shortcuts',
    'check-list-item-shortcuts',
    'code-block-keyboard-shortcuts',
  ],
  keyboardShortcuts: {
    Enter: ({ editor }) => toggleEnter(editor) || outdentEmptyItem(editor),
  },
  inputRules: [
    {
      find: /^```(.*?)\s$/,
      replace({ match }) {
        return { type: 'codeBlock', props: { language: codeLanguageFor(match[1]) }, content: [] }
      },
    },
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

const LIST_ITEMS = new Set(['bulletListItem', 'numberedListItem', 'checkListItem', 'toggleListItem'])

function outdentEmptyItem(editor: BlockNoteEditor): boolean {
  if (editor.getExtension(SuggestionMenu)?.shown() || !editor.prosemirrorState.selection.empty) return false
  const { block } = editor.getTextCursorPosition()
  const empty = Array.isArray(block.content) && block.content.length === 0
  if (!LIST_ITEMS.has(block.type) || !empty || !editor.canUnnestBlock()) return false
  editor.unnestBlock()
  return true
}

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
      group: '基本區塊',
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
    {
      key: 'bookmark',
      title: '網頁書籤',
      subtext: '網址變成有標題、摘要和縮圖的卡片',
      aliases: ['bookmark', 'web', 'link', 'url', '書籤', '網頁', '網址', '連結'],
      group: '媒體',
      icon: icon(BookmarkSimple),
      onItemClick: () => insertPicker(editor, { type: 'bookmark' }),
    } as DefaultReactSuggestionItem,
    {
      key: 'embed',
      title: '嵌入',
      subtext: 'YouTube、Google 地圖、Google 文件、Figma、Spotify…',
      aliases: ['embed', 'iframe', 'youtube', 'video', 'map', 'maps', 'figma', 'spotify', '嵌入', '影片', '地圖'],
      group: '媒體',
      icon: icon(FrameCorners),
      onItemClick: () => insertPicker(editor, { type: 'embed' }),
    } as DefaultReactSuggestionItem,
    ...getMultiColumnSlashMenuItems(anyEditor),
  ]

  if (note) {
    items.push(
      {
        key: 'page',
        title: '頁面',
        subtext: '在這裡建立子頁面並打開它',
        aliases: ['page', 'subpage', '頁面', '子頁面', '新頁面'],
        group: '頁面與看板',
        icon: icon(FileText),
        onItemClick: () => {
          const placeholder = insertOrUpdateBlockForSlashMenu(editor, { type: 'pageLink', props: { pageId: 0, mode: 'child' } })
          void note.createChildPage().then((page) => {
            if (!page) return editor.removeBlocks([placeholder.id])
            editor.updateBlock(placeholder.id, { props: { pageId: page.id } })
            // As in Notion, straight into the new page to name it (this one saves as it closes).
            note.openPage(page.id)
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
        onItemClick: () => insertPicker(editor, { type: 'pageLink', props: { pageId: 0, mode: 'link' } }),
      } as DefaultReactSuggestionItem,
      {
        key: 'board',
        title: '看板',
        subtext: '像 Notion 資料庫：每張卡片都是一頁',
        aliases: ['board', 'kanban', 'database', '看板', '任務看板', '資料庫'],
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
  const order = (item: DefaultReactSuggestionItem) => {
    const at = MENU_ORDER.indexOf((item as { key?: string }).key ?? '')
    return at < 0 ? MENU_ORDER.length : at
  }
  return items.map((item, i) => ({ item, i })).sort((a, b) => order(a.item) - order(b.item) || a.i - b.i).map(({ item }) => item)
}

/** The slash menu with nothing typed yet, top to bottom (Notion's order). */
const MENU_ORDER = [
  'paragraph', 'heading', 'heading_2', 'heading_3', 'bullet_list', 'numbered_list', 'check_list', 'toggle_list',
  'quote', 'callout', 'divider', 'code_block', 'table', 'toggle_heading', 'toggle_heading_2', 'toggle_heading_3',
  'page', 'link_to_page', 'board',
  'image', 'video', 'audio', 'file', 'bookmark', 'embed',
  'toc', 'two_columns', 'three_columns', 'emoji',
]

/** A block that opens a picker (link to page, bookmark, embed): only this new one takes the focus. */
function insertPicker(editor: NoteEditor, block: Parameters<NoteEditor['insertBlocks']>[0][number]) {
  markFresh(block.type as string)
  freshIs(insertOrUpdateBlockForSlashMenu(editor, block).id)
}

// BlockNote's zh-TW slash menu, in the words Notion uses in Taiwan (待辦清單,
// 項目符號清單, 引言…) and in one set of groups.
const BASIC = '基本區塊'
const slashMenu = {
  ...zhTW.slash_menu,
  paragraph: { title: '文字', subtext: '一般的段落文字', aliases: ['p', 'paragraph', 'text', '文字', '段落', '內文', '正文'], group: BASIC },
  heading: { title: '標題 1', subtext: '大的段落標題', aliases: ['h', 'h1', 'heading', 'heading1', '標題', '標題1', '大標題', '一級標題'], group: BASIC },
  heading_2: { title: '標題 2', subtext: '中的段落標題', aliases: ['h2', 'heading2', 'subheading', '標題', '標題2', '中標題', '副標題', '二級標題'], group: BASIC },
  heading_3: { title: '標題 3', subtext: '小的段落標題', aliases: ['h3', 'heading3', 'subheading', '標題', '標題3', '小標題', '三級標題'], group: BASIC },
  heading_4: { ...zhTW.slash_menu.heading_4, group: BASIC },
  heading_5: { ...zhTW.slash_menu.heading_5, group: BASIC },
  heading_6: { ...zhTW.slash_menu.heading_6, group: BASIC },
  toggle_heading: { title: '可收合標題 1', subtext: '點一下就能收起底下的內容', aliases: ['toggle', 'toggle heading', 'h1', '標題', '收合', '摺疊', '折疊', '切換標題'], group: BASIC },
  toggle_heading_2: { title: '可收合標題 2', subtext: '點一下就能收起底下的內容', aliases: ['toggle', 'toggle heading', 'h2', '標題', '收合', '摺疊', '折疊', '切換標題'], group: BASIC },
  toggle_heading_3: { title: '可收合標題 3', subtext: '點一下就能收起底下的內容', aliases: ['toggle', 'toggle heading', 'h3', '標題', '收合', '摺疊', '折疊', '切換標題'], group: BASIC },
  bullet_list: { title: '項目符號清單', subtext: '簡單的圓點清單', aliases: ['ul', 'bullet', 'bulleted list', 'list', '項目符號', '項目', '清單', '列表', '無序列表', '圓點'], group: BASIC },
  numbered_list: { title: '編號清單', subtext: '1. 2. 3. 依序編號', aliases: ['ol', 'numbered', 'numbered list', 'list', '編號', '編號清單', '數字', '清單', '列表', '有序列表'], group: BASIC },
  check_list: { title: '待辦清單', subtext: '可以打勾的待辦事項', aliases: ['todo', 'to-do', 'checkbox', 'check list', 'checklist', 'task', '待辦', '待辦清單', '待辦事項', '勾選', '核取方塊', '檢查清單', '清單'], group: BASIC },
  toggle_list: { title: '可收合清單', subtext: '點三角形展開或收起內容', aliases: ['toggle', 'toggle list', 'collapse', '收合', '摺疊', '折疊', '切換', '切換清單', '清單'], group: BASIC },
  quote: { title: '引言', subtext: '引用一段話', aliases: ['quote', 'quotation', 'blockquote', 'bq', '引言', '引用', '引述', '名言'], group: BASIC },
  divider: { title: '分隔線', subtext: '用一條線把內容分開', aliases: ['divider', 'hr', 'line', 'separator', '---', '分隔線', '分隔', '分割線', '橫線'], group: BASIC },
  code_block: { title: '程式碼', subtext: '有語法上色的程式碼區塊', aliases: ['code', 'codeblock', 'pre', '```', '程式碼', '程式碼區塊', '代碼', '程式'], group: BASIC },
  table: { title: '表格', subtext: '簡單的表格', aliases: ['table', '表格', '表'], group: BASIC },
  page_break: { ...zhTW.slash_menu.page_break, group: '進階' },
  emoji: { ...zhTW.slash_menu.emoji, group: '進階' },
}

export const editorDictionary = { ...zhTW, slash_menu: slashMenu, multi_column: multiColumnDictionary }
