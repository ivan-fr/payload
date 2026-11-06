import type { CollectionConfig } from 'payload'

import { targetsSlug } from '../slugs.js'

export const Targets: CollectionConfig = {
  slug: targetsSlug,
  access: { read: () => ({ title: { not_equals: 'Private' } }) },
  admin: {
    hidden: ({ user }) => Boolean(user),
    baseFilter: () => ({ tenant: { equals: 7 } }),
  },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'active', type: 'checkbox' },
    { name: 'tenant', type: 'number' },
  ],
}
