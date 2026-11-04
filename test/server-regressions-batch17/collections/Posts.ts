import type { CollectionConfig } from 'payload'

import { createTagField } from 'payload'

import { postsSlug, tagsSlug } from '../slugs.js'

export const Posts: CollectionConfig = {
  slug: postsSlug,
  fields: [{ name: 'title', type: 'text' }, createTagField({ relationTo: tagsSlug })],
}
