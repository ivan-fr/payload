import type { Block, CollectionConfig } from 'payload'

import { documentsSlug, pagesSlug } from '../slugs.js'

const guest: Block = { slug: 'guest', fields: [{ name: 'name', type: 'text' }] }

export const Documents: CollectionConfig = {
  slug: documentsSlug,
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'listedOn', type: 'join', collection: pagesSlug, on: 'layout.list.targets' },
    {
      name: 'listedInGroups',
      type: 'join',
      collection: pagesSlug,
      on: 'layout.list.groups.targets',
    },
  ],
}

export const Pages: CollectionConfig = {
  slug: pagesSlug,
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text' },
    {
      name: 'lineup',
      type: 'array',
      fields: [
        {
          name: 'performers',
          type: 'blocks',
          blocks: [
            {
              slug: 'artist',
              fields: [{ name: 'artist', type: 'relationship', relationTo: documentsSlug }],
            },
            guest,
          ],
        },
      ],
    },
    { name: 'otherPerformers', type: 'blocks', blocks: [guest] },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        { slug: 'text', fields: [{ name: 'text', type: 'text' }] },
        {
          slug: 'list',
          fields: [
            { name: 'targets', type: 'relationship', relationTo: documentsSlug, hasMany: true },
            {
              name: 'groups',
              type: 'array',
              fields: [
                { name: 'targets', type: 'relationship', relationTo: documentsSlug, hasMany: true },
              ],
            },
          ],
        },
      ],
    },
  ],
}
