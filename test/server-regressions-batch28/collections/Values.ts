import type { CollectionConfig } from 'payload'

import { collisionsSlug, valuesSlug } from '../slugs.js'
export const Values: CollectionConfig = {
  slug: valuesSlug,
  fields: [
    { name: 'labels', type: 'text', hasMany: true },
    { name: 'scores', type: 'number', hasMany: true },
    { name: 'related', type: 'relationship', relationTo: collisionsSlug, hasMany: true },
  ],
}
