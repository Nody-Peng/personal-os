import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { blocksToText } from '@/lib/blocks'
import { MAX_ICON_LENGTH, MAX_PAGE_TITLE } from '@/lib/notes'

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
