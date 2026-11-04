import type { CollectionConfig } from 'payload'

import { articlesSlug, categoriesSlug, postsSlug } from '../slugs.js'

const access = { create: () => true, read: () => true, update: () => true, delete: () => true }
export const Categories: CollectionConfig = {
  slug: categoriesSlug,
  access,
  versions: false,
  fields: [{ name: 'label', type: 'text' }],
}
export const Posts: CollectionConfig = {
  slug: postsSlug,
  access,
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'vat_number', type: 'text' },
    { name: 'owner', type: 'relationship', relationTo: categoriesSlug },
    { name: 'group_meta', type: 'group', fields: [{ name: 'tax_code', type: 'text' }] },
    { name: 'many', type: 'relationship', relationTo: categoriesSlug, hasMany: true },
  ],
}

export const Articles: CollectionConfig = {
  slug: articlesSlug,
  access,
  versions: false,
  fields: [{ name: 'body', type: 'richText', required: true }],
}
