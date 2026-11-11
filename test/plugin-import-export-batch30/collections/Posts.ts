import type { CollectionConfig } from 'payload'

import type {
  ExportAfterHook,
  ExportBeforeHook,
} from '../../../packages/plugin-import-export/src/types.js'

import { hookCalls } from '../hookCalls.js'
import { postsSlug } from '../slugs.js'

const before: ExportBeforeHook = ({ batchNumber, data, exportDoc }) => {
  hookCalls.before.push(batchNumber)

  if (exportDoc.skipFirstBatch && batchNumber === 1) {
    return []
  }

  return exportDoc.addColumns
    ? data.map(({ title, ...row }) => ({ ...row, [`batch_${batchNumber}`]: title }))
    : data
}

const after: ExportAfterHook = ({ batchNumber }) => {
  hookCalls.after.push(batchNumber)
}

export const Posts: CollectionConfig = {
  slug: postsSlug,
  versions: { drafts: true },
  access: { read: ({ req }) => Boolean(req.user) },
  admin: { custom: { 'plugin-import-export': { disabledFields: ['secret'] } } },
  custom: { 'plugin-import-export': { exportHooks: { after, before } } },
  fields: [
    {
      name: 'title',
      type: 'text',
      custom: {
        'plugin-import-export': {
          hooks: {
            beforeExport: ({ value }: { value: unknown }) => {
              hookCalls.field.push(value)
              return value
            },
          },
        },
      },
    },
    { name: 'secret', type: 'text' },
    { name: 'items', type: 'array', fields: [{ name: 'label', type: 'text' }] },
  ],
}
