import type { CollectionConfig } from 'payload'

import { usersSlug } from '../slugs.js'

export const Users: CollectionConfig = {
  slug: usersSlug,
  auth: true,
  access: { admin: () => true },
  fields: [{ name: 'role', type: 'select', options: ['viewer', 'editor'], defaultValue: 'viewer' }],
}
