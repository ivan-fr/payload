import type { CollectionConfig, Field } from 'payload'

import { createProductsCollection } from '../../../packages/plugin-ecommerce/src/collections/products/createProductsCollection.js'
import { createVariantsCollection } from '../../../packages/plugin-ecommerce/src/collections/variants/createVariantsCollection/index.js'
import {
  cartsSlug,
  machinesSlug,
  optionsSlug,
  productsSlug,
  transactionsSlug,
  typesSlug,
  usersSlug,
  variantsSlug,
} from '../slugs.js'

const access = { create: () => true, read: () => true, update: () => true, delete: () => true }
const ecommerceAccess = { isAdmin: () => true, adminOrPublishedStatus: () => true }
export const currenciesConfig = {
  defaultCurrency: 'USD',
  supportedCurrencies: [{ code: 'USD', decimals: 2, label: 'US dollar', symbol: '$' }],
}
const products = createProductsCollection({
  access: ecommerceAccess,
  currenciesConfig,
  enableVariants: true,
  inventory: false,
  variantsSlug,
  variantTypesSlug: typesSlug,
})
const variants = createVariantsCollection({
  access: ecommerceAccess,
  currenciesConfig,
  inventory: false,
  productsSlug,
  variantTypesSlug: typesSlug,
  variantOptionsSlug: optionsSlug,
})
export const Products: CollectionConfig = {
  ...products,
  slug: productsSlug,
  fields: [{ name: 'title', type: 'text' }, ...products.fields],
}
export const Variants: CollectionConfig = { ...variants, slug: variantsSlug }
export const Types: CollectionConfig = {
  slug: typesSlug,
  access,
  fields: [
    { name: 'name', type: 'text' },
    { name: 'label', type: 'text' },
    { name: 'options', type: 'join', collection: optionsSlug, on: 'variantType' },
  ],
}
export const Options: CollectionConfig = {
  slug: optionsSlug,
  access,
  fields: [
    { name: 'label', type: 'text' },
    { name: 'value', type: 'text' },
    { name: 'variantType', type: 'relationship', relationTo: typesSlug },
  ],
}
const items: Field = {
  name: 'items',
  type: 'array',
  fields: [
    { name: 'product', type: 'relationship', relationTo: productsSlug },
    { name: 'variant', type: 'relationship', relationTo: variantsSlug },
    { name: 'quantity', type: 'number' },
    { name: 'deliveryOption', type: 'text' },
  ],
}
export const Carts: CollectionConfig = {
  slug: cartsSlug,
  access,
  fields: [
    { name: 'subtotal', type: 'number' },
    { name: 'currency', type: 'text' },
    { name: 'customerEmail', type: 'text' },
    { name: 'secret', type: 'text' },
    structuredClone(items),
  ],
}
export const Transactions: CollectionConfig = {
  slug: transactionsSlug,
  access,
  fields: [
    structuredClone(items),
    { name: 'customer', type: 'relationship', relationTo: usersSlug },
    { name: 'customerEmail', type: 'text' },
    { name: 'cart', type: 'relationship', relationTo: cartsSlug },
    { name: 'amount', type: 'number' },
    { name: 'currency', type: 'text' },
    { name: 'status', type: 'text' },
    { name: 'paymentMethod', type: 'text' },
    { name: 'billingAddress', type: 'json' },
    {
      name: 'stripe',
      type: 'group',
      fields: [
        { name: 'paymentIntentID', type: 'text' },
        { name: 'customerID', type: 'text' },
      ],
    },
  ],
}
export const Machines: CollectionConfig = {
  slug: machinesSlug,
  auth: { useAPIKey: true, disableLocalStrategy: true },
  fields: [{ name: 'name', type: 'text' }],
}
export const Users: CollectionConfig = { slug: usersSlug, auth: true, fields: [] }
