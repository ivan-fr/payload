import type { CollectionConfig } from 'payload'

import { usersSlug } from '../slugs.js'

export const Users: CollectionConfig = {
  slug: usersSlug,
  auth: true,
  fields: [{ name: 'blockDelete', type: 'checkbox' }],
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        const doc = await req.payload.findByID({
          collection: usersSlug,
          id,
          overrideAccess: true,
          req,
        })
        if (doc.blockDelete) throw new Error('Deletion blocked')
      },
    ],
  },
}
