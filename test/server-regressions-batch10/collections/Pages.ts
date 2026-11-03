import type { CollectionConfig } from 'payload'

import { pagesSlug } from '../slugs.js'

export const Pages: CollectionConfig = {
  slug: pagesSlug,
  access: { read: () => true, create: () => true, update: () => true },
  fields: [{ name: 'title', type: 'text', required: true }],
}
