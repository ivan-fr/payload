import type { CollectionConfig } from 'payload'

import { uuidDocumentsSlug, uuidGroupsSlug, uuidUsersSlug } from '../slugs.js'

export const UUIDGroups: CollectionConfig = { slug: uuidGroupsSlug, fields: [] }
export const UUIDUsers: CollectionConfig = { slug: uuidUsersSlug, fields: [] }
export const UUIDDocuments: CollectionConfig = {
  slug: uuidDocumentsSlug,
  access: {
    read: ({ req }) =>
      req.context.emptyAccess ? { 'permissions.entity.value': { in: [] } } : true,
  },
  fields: [
    {
      name: 'permissions',
      type: 'array',
      fields: [
        { name: 'entity', type: 'relationship', relationTo: [uuidGroupsSlug, uuidUsersSlug] },
      ],
    },
  ],
}
