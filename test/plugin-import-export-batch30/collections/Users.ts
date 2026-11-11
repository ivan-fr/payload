import type { CollectionConfig } from 'payload'

import { usersSlug } from '../slugs.js'

export const Users: CollectionConfig = { slug: usersSlug, auth: true, fields: [] }
