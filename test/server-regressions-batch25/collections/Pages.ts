import type { CollectionConfig } from 'payload'

import { pagesSlug } from '../slugs.js'

export const Pages: CollectionConfig = {
  slug: pagesSlug,
  fields: [
    {
      name: 'content',
      type: 'blocks',
      blocks: [
        { slug: 'text', fields: [{ name: 'body', type: 'text' }] },
        {
          slug: 'grid',
          fields: [
            {
              name: 'cols',
              type: 'blocks',
              blocks: [{ slug: 'image', fields: [{ name: 'alt', type: 'text' }] }],
            },
          ],
        },
        {
          slug: 'story',
          fields: [
            {
              name: 'cols',
              type: 'blocks',
              blocks: [{ slug: 'story-image', fields: [{ name: 'alt', type: 'text' }] }],
            },
          ],
        },
      ],
    },
  ],
}
