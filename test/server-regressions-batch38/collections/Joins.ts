import type { CollectionConfig } from 'payload'

import { articlesSlug, holdersSlug, notesSlug } from '../slugs.js'

export const Articles: CollectionConfig = {
  slug: articlesSlug,
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'owner', type: 'relationship', relationTo: holdersSlug },
  ],
}

export const Notes: CollectionConfig = {
  slug: notesSlug,
  access: {
    read: ({ req }) =>
      req.context.notesAccess === 'deny'
        ? false
        : req.context.notesAccess === 'where'
          ? { visibility: { equals: 'public' } }
          : true,
  },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'visibility', type: 'select', options: ['public', 'private'] },
    { name: 'owner', type: 'relationship', relationTo: holdersSlug },
  ],
}

export const Holders: CollectionConfig = {
  slug: holdersSlug,
  access: { read: () => true },
  fields: [{ name: 'entries', type: 'join', collection: [articlesSlug, notesSlug], on: 'owner' }],
}
