import type { CollectionConfig, FieldHook } from 'payload'

import { createTransactionsCollection } from '../../../packages/plugin-ecommerce/src/collections/transactions/createTransactionsCollection.js'
import { USD } from '../../../packages/plugin-ecommerce/src/currencies/index.js'
import { fieldsSlug, foldersSlug, publicSlug, restrictedSlug } from '../slugs.js'

const recordRead: FieldHook = ({ context, field, value }) => {
  if (Array.isArray(context.reads)) {
    context.reads.push('name' in field ? field.name : field.type)
  }
  return value
}

export const Fields: CollectionConfig = {
  slug: fieldsSlug,
  access: { read: () => true },
  fields: [
    { name: 'visible', type: 'text', hooks: { afterRead: [recordRead] } },
    { name: 'hidden', type: 'text', hidden: true, hooks: { afterRead: [recordRead] } },
    {
      name: 'denied',
      type: 'text',
      access: { read: () => false },
      hooks: { afterRead: [recordRead] },
    },
    {
      name: 'deniedGroup',
      type: 'group',
      access: { read: () => false },
      fields: [{ name: 'child', type: 'text', hooks: { afterRead: [recordRead] } }],
    },
  ],
}

export const Folders: CollectionConfig = {
  slug: foldersSlug,
  access: { read: () => true },
  fields: [
    { name: 'documents', type: 'join', collection: [restrictedSlug, publicSlug], on: 'folder' },
  ],
}

export const Public: CollectionConfig = {
  slug: publicSlug,
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'folder', type: 'relationship', relationTo: foldersSlug },
  ],
}

export const Restricted: CollectionConfig = {
  slug: restrictedSlug,
  access: {
    read: ({ req }) => (req.context.denyBranch ? false : { visibility: { equals: 'public' } }),
  },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'visibility', type: 'select', options: ['public', 'private'] },
    { name: 'folder', type: 'relationship', relationTo: foldersSlug },
  ],
}

export const Transactions = createTransactionsCollection({
  access: { isAdmin: () => true },
  addressFields: [
    { name: 'addressLine1', type: 'text' },
    { name: 'addressLine2', type: 'text' },
  ],
  cartsSlug: foldersSlug,
  currenciesConfig: { defaultCurrency: 'USD', supportedCurrencies: [USD] },
  ordersSlug: fieldsSlug,
  productsSlug: publicSlug,
})
