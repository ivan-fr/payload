import type { CollectionConfig } from 'payload'

import { collisionsSlug } from '../slugs.js'
export const Collisions: CollectionConfig = {
  slug: collisionsSlug,
  versions: { drafts: true },
  fields: [
    { name: 'numbers', type: 'array', fields: [{ name: 'value', type: 'number' }] },
    { name: 'texts', type: 'array', fields: [{ name: 'value', type: 'text' }] },
  ],
}
