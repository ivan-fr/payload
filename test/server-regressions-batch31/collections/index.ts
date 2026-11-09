import type { CollectionConfig } from 'payload'

import { otherSlug, postsSlug } from '../slugs.js'

export const Posts: CollectionConfig = {
  slug: postsSlug,
  versions: { drafts: { schedulePublish: true } },
  fields: [{ name: 'title', type: 'text' }],
}
export const Other: CollectionConfig = { ...Posts, slug: otherSlug }
