import type { CollectionConfig } from 'payload'

import { APIError } from 'payload'

import { pagesSlug } from '../slugs.js'

export const Pages: CollectionConfig = {
  slug: pagesSlug,
  fields: [{ name: 'title', type: 'text', required: true }],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, req }) => {
        if (req.context.failChildID !== undefined && req.context.failChildID === originalDoc?.id) {
          throw new APIError('Child save was rejected', 409, undefined, true)
        }
        return data
      },
    ],
  },
}
