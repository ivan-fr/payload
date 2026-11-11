import type { CollectionConfig } from 'payload'

import { targetsSlug } from '../slugs.js'

export const Targets: CollectionConfig = {
  slug: targetsSlug,
  access: { read: () => true },
  fields: [{ name: 'title', type: 'text' }],
}
