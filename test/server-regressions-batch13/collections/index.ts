import type { CollectionConfig } from 'payload'

import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

import { cloudStoragePlugin } from '../../../packages/plugin-cloud-storage/src/plugin.js'
import { getFilePrefix } from '../../../packages/plugin-cloud-storage/src/utilities/getFilePrefix.js'
import { cloudSlug, fillerSlugs, mediaSlug, otherSlug, postsSlug } from '../slugs.js'

const access = { create: () => true, read: () => true, update: () => true, delete: () => true }
export const uploadDir = path.join(os.tmpdir(), `payload-batch13-${randomUUID()}`)

export const Posts: CollectionConfig = {
  slug: postsSlug,
  access,
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'meta', type: 'json' },
    { name: 'location', type: 'point' },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'label', type: 'text' },
        {
          name: 'children',
          type: 'array',
          fields: [
            { name: 'label', type: 'text' },
            {
              name: 'code',
              type: 'text',
              defaultValue: 'DEFAULT',
              access: {
                update: ({ req }) =>
                  Boolean(req.user && 'role' in req.user && req.user.role === 'admin'),
              },
            },
          ],
        },
      ],
    },
  ],
}
export const Media: CollectionConfig = {
  slug: mediaSlug,
  versions: false,
  access: { ...access, read: ({ req }) => req.headers.get('x-deny-file') !== 'true' },
  upload: { staticDir: uploadDir },
  fields: [],
}
export const Other: CollectionConfig = {
  slug: otherSlug,
  versions: false,
  access,
  fields: [{ name: 'title', type: 'text' }],
}
export const Fillers: CollectionConfig[] = fillerSlugs.map((slug) => ({
  slug,
  access,
  versions: false,
  fields: [],
}))

// Exercise the real cloud plugin's handler contract without contacting a provider.
export const Cloud: CollectionConfig = {
  slug: cloudSlug,
  versions: false,
  access: { ...access, read: ({ isReadingStaticFile }) => Boolean(isReadingStaticFile) },
  upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
  fields: [],
}
export const cloudPlugin = cloudStoragePlugin({
  collections: {
    [cloudSlug]: {
      adapter: ({ collection }) => ({
        name: 'batch13-memory',
        copyFile: async () => undefined,
        handleUpload: async () => undefined,
        handleDelete: async () => undefined,
        deleteFile: async () => undefined,
        generateURL: ({ filename }) => `https://storage.example.com/${filename}`,
        staticHandler: async (req, { doc, params: { filename } }) => {
          const prefix = await getFilePrefix({ collection, doc, filename, req })
          return new Response(`object:${prefix}/${filename}`, {
            headers: { 'Content-Type': 'text/plain' },
          })
        },
      }),
    },
  },
})
