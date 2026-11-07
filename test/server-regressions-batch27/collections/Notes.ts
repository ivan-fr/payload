import type { CollectionConfig } from 'payload'

import { notesSlug } from '../slugs.js'
export const Notes: CollectionConfig = {
  slug: notesSlug,
  fields: [{ name: 'title', type: 'text', required: true }],
  hooks: {
    beforeValidate: [
      ({ data, req }) => {
        if (req.context.captureFile) {
          req.context.observedFile = req.file
        }
        return data
      },
    ],
  },
}
