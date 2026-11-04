import type { CollectionConfig } from 'payload'

import { createTagField } from 'payload'

import { pagesSlug, tagsSlug } from '../slugs.js'

export const Pages: CollectionConfig = {
  slug: pagesSlug,
  fields: [
    { name: 'title', type: 'text' },
    createTagField({ relationTo: tagsSlug, hasMany: false }),
  ],
}
