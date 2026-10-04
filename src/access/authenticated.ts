import type { Access } from 'payload'

// Single-owner app: every private document is readable and writable by
// whoever is logged in, and by nobody else.
export const authenticated: Access = ({ req }) => Boolean(req.user)
