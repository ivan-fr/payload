import type { CollectionConfig } from 'payload'

import { validateOptions } from '../../../packages/plugin-ecommerce/src/collections/variants/createVariantsCollection/hooks/validateOptions.js'
import { localizedSlug, productsSlug, variantsSlug } from '../slugs.js'

const access = { create: () => true, read: () => true, update: () => true, delete: () => true }

export const Products: CollectionConfig = {
  slug: productsSlug,
  access,
  fields: [
    { name: 'title', type: 'text' },
    { name: 'variantTypes', type: 'json' },
    { name: 'variants', type: 'join', collection: variantsSlug, on: 'product' },
  ],
}

export const Variants: CollectionConfig = {
  slug: variantsSlug,
  access,
  trash: false,
  fields: [
    { name: 'product', type: 'relationship', relationTo: productsSlug, required: true },
    {
      name: 'options',
      type: 'json',
      validate: validateOptions({ productsCollectionSlug: productsSlug }),
    },
  ],
}

export const Localized: CollectionConfig = {
  slug: localizedSlug,
  access,
  fields: [
    { name: 'legal', type: 'group', localized: true, fields: [{ name: 'notice', type: 'text' }] },
    {
      type: 'tabs',
      tabs: [{ name: 'details', localized: true, fields: [{ name: 'note', type: 'text' }] }],
    },
  ],
}
