import type { CollectionConfig, PayloadRequest } from 'payload'

import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

import { labelsSlug, mediaSlug, postsSlug } from '../slugs.js'

const access = { create: () => true, read: () => true, update: () => true, delete: () => true }

export const Posts: CollectionConfig = {
  slug: postsSlug,
  access,
  versions: { drafts: true, maxPerDoc: 100 },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'items', type: 'array', fields: [{ name: 'label', type: 'text' }] },
    {
      name: 'content',
      type: 'blocks',
      blocks: [{ slug: 'text', fields: [{ name: 'body', type: 'text' }] }],
    },
  ],
}

export const Media: CollectionConfig = {
  slug: mediaSlug,
  access,
  versions: false,
  upload: {
    filesRequiredOnCreate: false,
    staticDir: path.join(os.tmpdir(), `payload-batch9-${randomUUID()}`),
  },
  fields: [
    { name: 'owner', type: 'text' },
    { name: 'description', type: 'text' },
  ],
}

export const Labels: CollectionConfig = {
  slug: labelsSlug,
  access,
  versions: false,
  fields: [
    {
      name: 'label',
      type: 'text',
      localized: true,
      validate: async (_value: unknown, { req }: { req: PayloadRequest }) => {
        const locale = req.locale
        await req.payload.find({ collection: labelsSlug, locale: 'en', depth: 0, req })
        return req.locale === locale || 'Nested read changed the parent locale'
      },
    },
  ],
}
