import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

// What Claude changed through the MCP endpoint (lib/mcpActivity.ts), listed on
// /studio with a way back: the version history entry taken just before a
// content change, or the trash.
export const McpActivity: CollectionConfig = {
  slug: 'mcp-activity',
  labels: { singular: 'MCP 動作', plural: 'MCP 動作紀錄' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'keyName', 'tool', 'pageTitle'],
  },
  defaultSort: '-createdAt',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'key', label: '金鑰', type: 'relationship', relationTo: 'mcp-keys', admin: { description: '空白＝Vercel 上的 MCP_TOKEN' } },
    { name: 'keyName', label: '金鑰名稱', type: 'text', required: true },
    { name: 'tool', label: '工具', type: 'text', required: true, index: true },
    { name: 'pageId', label: '頁面 id', type: 'number', index: true },
    { name: 'notebookId', label: '筆記本 id', type: 'number' },
    { name: 'pageTitle', label: '頁面標題', type: 'text' },
    { name: 'summary', label: '結果', type: 'text' },
    { name: 'snapshotId', label: '改動前的版本', type: 'number', admin: { description: '版本紀錄（page-snapshots）的 id' } },
    { name: 'emptyBefore', label: '改動前是空白頁', type: 'checkbox', defaultValue: false },
    { name: 'undoneAt', label: '已還原', type: 'date' },
  ],
}
