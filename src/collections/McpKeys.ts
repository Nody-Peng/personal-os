import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

// Keys for the MCP endpoint (/api/mcp), issued and revoked on /studio
// (lib/mcpKeys.ts). Only a SHA-256 hash of each key is stored, and nobody can
// read it back: the key itself is shown once, when it is made.
export const McpKeys: CollectionConfig = {
  slug: 'mcp-keys',
  labels: { singular: 'MCP 金鑰', plural: 'MCP 金鑰' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'prefix', 'lastUsedAt', 'revokedAt', 'createdAt'],
  },
  defaultSort: '-createdAt',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'name', label: '名稱', type: 'text', required: true },
    { name: 'prefix', label: '開頭', type: 'text', required: true, admin: { readOnly: true, description: '金鑰的前幾個字，用來辨認' } },
    {
      name: 'hash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      access: { read: () => false, update: () => false },
      admin: { hidden: true },
    },
    {
      name: 'user',
      label: '代表的帳號',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      access: { update: () => false },
      admin: { readOnly: true },
    },
    { name: 'expiresAt', label: '到期', type: 'date', access: { update: () => false }, admin: { readOnly: true } },
    { name: 'lastUsedAt', label: '最後使用', type: 'date', admin: { readOnly: true } },
    { name: 'revokedAt', label: '撤銷', type: 'date', index: true, admin: { readOnly: true } },
  ],
}
