import type { CollectionConfig } from 'payload'

import { BlocksFeature, lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'

import { blocksSlug, mediaSlug, postsSlug } from '../slugs.js'

export const Posts: CollectionConfig = {
  slug: postsSlug,
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: [
          UploadFeature({ enabledCollections: [mediaSlug] }),
          BlocksFeature({
            blocks: [
              {
                slug: blocksSlug,
                fields: [
                  {
                    name: 'label',
                    type: 'text',
                    required: true,
                    hooks: {
                      beforeChange: [
                        ({ value }) =>
                          typeof value === 'string' ? value.trim().toUpperCase() : value,
                      ],
                      afterChange: [
                        ({ req, value }) => {
                          const events = req.context.slotChanges as unknown[] | undefined
                          events?.push(value)
                          return value
                        },
                      ],
                      afterRead: [({ value }) => `read:${value}`],
                    },
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
