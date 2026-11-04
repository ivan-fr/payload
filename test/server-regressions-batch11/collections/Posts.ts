import type { CollectionConfig } from 'payload'

import { indexedSlug, postsSlug } from '../slugs.js'

const access = { create: () => true, read: () => true, update: () => true }
export const Posts: CollectionConfig = {
  slug: postsSlug,
  access,
  fields: [
    { name: 'title', type: 'text' },
    { name: 'referenceLayout', type: 'blocks', blocks: ['shared'] },
    { name: 'date', type: 'date', timezone: true },
    {
      name: 'mode',
      type: 'select',
      options: ['online', { label: 'In person', value: 'inPerson' }],
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [{ slug: 'hero', fields: [{ name: 'heading', type: 'text', required: true }] }],
    },
  ],
}
export const Indexed: CollectionConfig = {
  slug: indexedSlug,
  access,
  versions: { drafts: true },
  fields: [{ name: 'title', type: 'text' }],
}
