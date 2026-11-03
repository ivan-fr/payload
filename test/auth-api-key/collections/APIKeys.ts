import type { CollectionConfig } from 'payload'

import { apiKeysSlug } from '../shared.js'

export const APIKeys: CollectionConfig = {
  slug: apiKeysSlug,
  access: {
    read: ({ req: { payload, user } }) => {
      if (user?.collection === payload.config.admin.user) return true
      if (user?.collection === apiKeysSlug) return { id: { equals: user.id } }
      return false
    },
  },
  auth: {
    disableLocalStrategy: true,
    useAPIKey: true,
  },
  fields: [{ name: 'name', type: 'text' }],
  labels: {
    plural: 'API Keys',
    singular: 'API Key',
  },
}
