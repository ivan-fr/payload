import type { CollectionConfig } from 'payload'
import type { FieldBeforeExportHook } from '../../../packages/plugin-import-export/src/types.js'

import { postsSlug, restrictedSlug } from '../slugs.js'

export const Posts: CollectionConfig = {
  slug: postsSlug,
  versions: { drafts: true },
  graphQL: { singularName: 'BatchSixPost', pluralName: 'BatchSixPosts' },
  access: { create: () => true, read: () => true, update: () => true, delete: () => false },
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
      hooks: {
        beforeDuplicate: [
          async ({ req, value }) => {
            await Promise.resolve()
            return `${value}-${req.locale}`
          },
        ],
      },
    },
    { name: 'keepArray', type: 'checkbox' },
    { name: 'items', type: 'array', fields: [{ name: 'label', type: 'text' }] },
    {
      name: 'tags',
      type: 'array',
      fields: [{ name: 'label', type: 'text' }],
      custom: {
        'plugin-import-export': {
          hooks: {
            beforeExport: (({ data, value }) =>
              data.keepArray
                ? undefined
                : ((value as { label: string }[]) ?? [])
                    .map(({ label }) => label)
                    .join(' | ')) satisfies FieldBeforeExportHook,
          },
        },
      },
    },
  ],
}
export const Restricted: CollectionConfig = {
  slug: restrictedSlug,
  access: { read: () => false },
  fields: [{ name: 'allowed', type: 'checkbox' }],
}
