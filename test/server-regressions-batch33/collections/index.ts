import type { CollectionConfig } from 'payload'

import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

import { mediaSlug, peopleSlug, reportsSlug } from '../slugs.js'

export const People: CollectionConfig = {
  slug: peopleSlug,
  fields: [{ name: 'name', type: 'text' }],
}
// Both names represent the transition around a field rename, so the migration can be read back.
export const Reports: CollectionConfig = {
  slug: reportsSlug,
  versions: true,
  fields: [
    { name: 'owners', type: 'relationship', relationTo: peopleSlug, hasMany: true },
    { name: 'owners2', type: 'relationship', relationTo: peopleSlug, hasMany: true },
    { name: 'reviewers', type: 'relationship', relationTo: peopleSlug, hasMany: true },
  ],
}

export const Media: CollectionConfig = {
  slug: mediaSlug,
  access: { read: () => true },
  upload: { staticDir: path.join(os.tmpdir(), `payload-batch33-${randomUUID()}`) },
  fields: [],
}
