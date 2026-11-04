import type { CollectionConfig } from 'payload'

import { otherUsersSlug } from '../slugs.js'

export const OtherUsers: CollectionConfig = {
  slug: otherUsersSlug,
  auth: true,
  fields: [],
}
