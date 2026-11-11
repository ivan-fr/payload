import type { CollectionConfig } from 'payload'

import { categoriesSlug, documentsSlug, postsSlug } from '../slugs.js'

export const Categories: CollectionConfig = {
  slug: categoriesSlug,
  access: { read: () => ({ state: { not_equals: 'hidden' } }) },
  fields: [
    { name: 'slug', type: 'text' },
    { name: 'state', type: 'text' },
  ],
}

export const Posts: CollectionConfig = {
  slug: postsSlug,
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'score', type: 'number' },
    { name: 'category', type: 'relationship', relationTo: categoriesSlug },
    { name: 'entity', type: 'relationship', relationTo: [categoriesSlug, documentsSlug] },
    {
      name: 'secret',
      type: 'text',
      access: { read: () => false },
      hooks: {
        afterRead: [
          ({ req, value }) => {
            ;(req.context.fieldReadCalls as string[] | undefined)?.push('secret')
            return value
          },
        ],
      },
    },
    {
      name: 'internal',
      type: 'text',
      hidden: true,
      defaultValue: 'default',
      hooks: {
        afterRead: [
          ({ req, value }) => {
            ;(req.context.fieldReadCalls as string[] | undefined)?.push('internal')
            return value
          },
        ],
      },
    },
  ],
}
