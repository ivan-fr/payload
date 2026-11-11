import type { CollectionConfig } from 'payload'

import { articlesSlug } from '../slugs.js'

export const Articles: CollectionConfig = {
  slug: articlesSlug,
  versions: { drafts: { schedulePublish: true } },
  fields: [
    { name: 'title', type: 'text' },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        {
          slug: 'card',
          fields: [
            { name: 'heading', type: 'text' },
            { name: 'caption', type: 'text' },
          ],
        },
      ],
    },
  ],
}
