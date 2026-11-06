import type { CollectionConfig } from 'payload'

import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'

import { postsSlug, targetsSlug } from '../slugs.js'

export const Posts: CollectionConfig = {
  slug: postsSlug,
  access: { create: () => true, read: () => true, update: () => true },
  fields: [
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: [
          BlocksFeature({
            blocks: [
              {
                slug: 'related',
                fields: [
                  {
                    name: 'target',
                    type: 'relationship',
                    relationTo: targetsSlug,
                    filterOptions: { active: { equals: true } },
                  },
                ],
              },
            ],
          }),
        ],
      }),
    },
  ],
}
