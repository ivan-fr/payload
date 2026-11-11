import type { CollectionConfig, Field } from 'payload'

import { previewPagesSlug, targetsSlug } from '../slugs.js'

export const previewFields: Field[] = [
  {
    name: 'hero',
    type: 'group',
    localized: true,
    fields: [
      { name: 'mode', type: 'text' },
      { name: 'internal', type: 'text', hidden: true },
      { name: 'en', type: 'text' },
      {
        name: 'items',
        type: 'array',
        fields: [
          { name: 'label', type: 'text' },
          { name: 'target', type: 'relationship', relationTo: targetsSlug },
        ],
      },
    ],
  },
  {
    type: 'tabs',
    tabs: [
      {
        name: 'details',
        localized: true,
        fields: [
          { name: 'mode', type: 'text' },
          {
            name: 'items',
            type: 'array',
            fields: [{ name: 'target', type: 'relationship', relationTo: targetsSlug }],
          },
        ],
      },
    ],
  },
  {
    name: 'rows',
    type: 'array',
    localized: true,
    fields: [{ name: 'target', type: 'relationship', relationTo: targetsSlug }],
  },
  {
    name: 'content',
    type: 'blocks',
    localized: true,
    blocks: [
      {
        slug: 'related',
        fields: [{ name: 'target', type: 'relationship', relationTo: targetsSlug }],
      },
    ],
  },
]

export const PreviewPages: CollectionConfig = {
  slug: previewPagesSlug,
  access: { read: () => true },
  fields: previewFields,
}
