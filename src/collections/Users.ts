import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

// Single-owner app. The first account is made at /admin/create-first-user;
// after that, only a logged-in user can add another.
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: '使用者', plural: '使用者' },
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // stay signed in on the phone for 30 days
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [],
}
