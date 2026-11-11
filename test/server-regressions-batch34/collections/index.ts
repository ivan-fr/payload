import type { CollectionConfig, Field } from 'payload'

import { articlesSlug, peopleSlug } from '../slugs.js'

const children: Field[] = [
  { name: 'mode', type: 'text' },
  { name: 'owner', type: 'relationship', relationTo: peopleSlug },
  { name: 'items', type: 'array', fields: [{ name: 'label', type: 'text' }] },
]

export const People: CollectionConfig = {
  slug: peopleSlug,
  fields: [{ name: 'name', type: 'text' }],
}

export const Articles: CollectionConfig = {
  slug: articlesSlug,
  versions: { drafts: true },
  fields: [
    { name: 'sortOrder', type: 'number' },
    { name: 'items', type: 'array', fields: [{ name: 'label', type: 'text' }] },
    { name: 'hero', type: 'group', localized: true, fields: children },
    { type: 'tabs', tabs: [{ name: 'details', localized: true, fields: children }] },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        {
          slug: 'text',
          fields: [
            { name: 'heading', type: 'text' },
            { name: 'caption', type: 'text' },
            { name: 'owner', type: 'relationship', relationTo: peopleSlug },
            { name: 'reviewer', type: 'relationship', relationTo: peopleSlug },
          ],
        },
      ],
    },
    {
      name: 'localizedDefault',
      type: 'text',
      localized: true,
      defaultValue: ({ locale }) => `default-${locale}`,
    },
    { name: 'plainDefault', type: 'text', defaultValue: 'plain' },
  ],
}
