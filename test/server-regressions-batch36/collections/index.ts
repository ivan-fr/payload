import type { CollectionConfig } from 'payload'

import { contextSlug, defaultsSlug, namesSlug } from '../slugs.js'

const defaultRows = Array(4).fill({ label: 'Default' })

export const Defaults: CollectionConfig = {
  slug: defaultsSlug,
  access: { create: () => true, read: () => true, update: () => true },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text' },
    {
      name: 'items',
      type: 'array',
      defaultValue: () => Promise.resolve(defaultRows),
      fields: [{ name: 'label', type: 'text', required: true }],
    },
  ],
}

export const ContextItems: CollectionConfig = {
  slug: contextSlug,
  access: { create: () => true, read: () => true, update: () => true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'leaked', type: 'checkbox', virtual: true },
    { name: 'owner', type: 'relationship', relationTo: namesSlug },
  ],
  hooks: {
    afterRead: [
      async ({ doc, req, context }) => {
        if (context.probe && !context.nested) {
          await req.payload.find({
            collection: contextSlug,
            context: { nested: true },
            req,
            depth: 0,
            limit: 1,
          })
          doc.leaked = Boolean(req.context.nested)
        }
        return doc
      },
    ],
    beforeChange: [
      async ({ data, req, context }) => {
        if (context.failAfterNestedWrite) {
          await req.payload.update({
            collection: contextSlug,
            id: context.targetID as number | string,
            data: { title: 'Must roll back' },
            context: { failAfterNestedWrite: false },
            req,
          })
          throw new Error('Rollback parent and nested write')
        }
        return data
      },
    ],
  },
}

export const Names: CollectionConfig = {
  slug: namesSlug,
  access: { create: () => true, read: () => true },
  fields: [{ name: 'observedContext', type: 'text', virtual: true }],
  hooks: {
    afterRead: [({ doc, context }) => ({ ...doc, observedContext: context.marker ?? null })],
  },
}
