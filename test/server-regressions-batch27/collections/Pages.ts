import type { CollectionConfig } from 'payload'

import { pagesSlug } from '../slugs.js'
export const Pages: CollectionConfig = {
  slug: pagesSlug,
  admin: { listSearchableFields: ['id', 'title'] },
  versions: { drafts: true },
  fields: [{ name: 'title', type: 'text' }],
}
