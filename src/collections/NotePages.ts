import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { blocksToText } from '@/lib/blocks'
import { isDay } from '@/lib/day'
import { MAX_ICON_LENGTH, MAX_PAGE_TITLE } from '@/lib/notes'
import { ITEM_STATUSES, PAGE_FONTS, PAGE_KINDS, selectOptions, TEMPLATE_KINDS } from '@/lib/options'

const optionalDay = (value: string | null | undefined) => !value || isDay(value) || '請用 YYYY-MM-DD 格式'

const idOf = (value: unknown): number | null =>
  value == null ? null : typeof value === 'object' ? ((value as { id?: number }).id ?? null) : Number(value)

// Notion-style pages inside a notebook. Pages nest without limit through
// `parent`; deleting moves a page to the trash (Payload's `deletedAt`).
export const NotePages: CollectionConfig = {
  slug: 'note-pages',
  labels: { singular: '筆記頁面', plural: '筆記頁面' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'notebook', 'parent', 'editedAt'],
  },
  defaultSort: 'position',
  trash: true,
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'icon', label: '圖示', type: 'text', maxLength: MAX_ICON_LENGTH, admin: { width: '20%' } },
        { name: 'title', label: '標題', type: 'text', maxLength: MAX_PAGE_TITLE },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'notebook', label: '筆記本', type: 'relationship', relationTo: 'notebooks', required: true, index: true },
        { name: 'parent', label: '上層頁面', type: 'relationship', relationTo: 'note-pages', index: true },
        { name: 'position', label: '排序', type: 'number', defaultValue: 0 },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'kind', label: '類型', type: 'select', defaultValue: 'page', index: true, options: selectOptions(PAGE_KINDS) },
        { name: 'status', label: '狀態（看板項目）', type: 'select', options: selectOptions(ITEM_STATUSES) },
        { name: 'parentItem', label: '上級項目', type: 'relationship', relationTo: 'note-pages', index: true },
      ],
    },
    {
      // The page's ••• menu (Notion's page customization) and the sidebar star.
      type: 'row',
      fields: [
        { name: 'font', label: '字型', type: 'select', defaultValue: 'default', options: selectOptions(PAGE_FONTS) },
        { name: 'smallText', label: '小字', type: 'checkbox', defaultValue: false },
        { name: 'fullWidth', label: '全寬', type: 'checkbox', defaultValue: false },
        { name: 'locked', label: '鎖定頁面', type: 'checkbox', defaultValue: false },
        { name: 'favorite', label: '我的最愛', type: 'checkbox', defaultValue: false, index: true },
        { name: 'templateFor', label: '範本', type: 'select', index: true, options: selectOptions(TEMPLATE_KINDS) },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startDate', label: '日期（開始）', type: 'text', validate: optionalDay, admin: { description: 'YYYY-MM-DD' } },
        { name: 'endDate', label: '日期（結束）', type: 'text', validate: optionalDay, admin: { description: 'YYYY-MM-DD' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'cover', label: '封面圖片', type: 'text', admin: { description: '/api/media/file/… 的網址' } },
        { name: 'coverPosition', label: '封面垂直位置', type: 'number', min: 0, max: 100, defaultValue: 50 },
      ],
    },
    {
      name: 'content',
      label: '內容',
      type: 'json',
      admin: { description: 'Notion 式編輯器的區塊資料（在前台編輯）' },
    },
    {
      name: 'plainText',
      label: '純文字（搜尋用）',
      type: 'textarea',
      admin: { readOnly: true, description: '儲存內容時自動產生' },
    },
    {
      name: 'editedAt',
      label: '最後編輯',
      type: 'date',
      index: true,
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if ('content' in data) data.plainText = blocksToText(data.content)

        // 上級項目: another item on the same board, without loops.
        const parentItemId = idOf({ ...originalDoc, ...data }.parentItem)
        if (parentItemId != null && parentItemId !== idOf(originalDoc?.parentItem)) {
          const boardId = idOf({ ...originalDoc, ...data }.parent)
          let current: number | null = parentItemId
          for (let depth = 0; current != null; depth++) {
            if (current === idOf(originalDoc?.id) || depth > 200) throw new Error('上級項目不能是自己或自己的子項目')
            const item = await req.payload.findByID({
              collection: 'note-pages',
              id: current,
              depth: 0,
              trash: true,
              select: { kind: true, parent: true, parentItem: true },
              req,
            })
            if (depth === 0 && (item.kind !== 'item' || idOf(item.parent) !== boardId)) {
              throw new Error('上級項目必須是同一個看板裡的其他項目')
            }
            current = idOf(item.parentItem)
          }
        }

        // A parent must be in the same notebook and must not be the page
        // itself or one of its descendants. Autosaves leave both alone.
        const merged = { ...originalDoc, ...data }
        const parentId = idOf(merged.parent)
        if (parentId == null) return data
        const unchanged =
          operation === 'update' &&
          parentId === idOf(originalDoc?.parent) &&
          idOf(merged.notebook) === idOf(originalDoc?.notebook)
        if (unchanged) return data
        const selfId = idOf(originalDoc?.id)
        const notebookId = idOf(merged.notebook)
        let current: number | null = parentId
        for (let depth = 0; current != null; depth++) {
          if (current === selfId || depth > 200) throw new Error('不能把頁面放進自己或自己的子頁面裡')
          const page = await req.payload.findByID({
            collection: 'note-pages',
            id: current,
            depth: 0,
            trash: true,
            select: { notebook: true, parent: true },
            req,
          })
          if (depth === 0 && idOf(page.notebook) !== notebookId) throw new Error('上層頁面必須在同一本筆記本')
          current = idOf(page.parent)
        }
        return data
      },
    ],
  },
}
