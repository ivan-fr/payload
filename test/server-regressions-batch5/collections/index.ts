import type { CollectionConfig } from 'payload'

import { postsSlug, placesSlug, eventsSlug, mediaSlug } from '../slugs.js'

export const Posts: CollectionConfig = {
  access: { create: () => true, read: () => true, update: () => true, delete: () => true },
  slug: postsSlug,
  defaultSort: '-title',
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'archived', type: 'checkbox' },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation === 'update' && originalDoc.title === 'fail')
          throw new Error('Refused update')
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const doc = await req.payload.findByID({ collection: postsSlug, id, req })
        if (doc.title === 'fail') throw new Error('Refused delete')
      },
    ],
  },
}
export const Places: CollectionConfig = {
  access: { create: () => true, read: () => true },
  slug: placesSlug,
  fields: [
    { name: 'title', type: 'text' },
    { name: 'image', type: 'upload', relationTo: mediaSlug },
    { name: 'related', type: 'relationship', relationTo: postsSlug },
    { name: 'many', type: 'relationship', relationTo: postsSlug, hasMany: true },
  ],
}
export const Events: CollectionConfig = {
  access: { create: () => true, read: () => true },
  slug: eventsSlug,
  fields: [
    { name: 'place', type: 'relationship', relationTo: placesSlug },
    { name: 'imageAlias', type: 'upload', relationTo: mediaSlug, virtual: 'place.image' },
    { name: 'alias', type: 'relationship', relationTo: postsSlug, virtual: 'place.related' },
    {
      name: 'manyAlias',
      type: 'relationship',
      relationTo: postsSlug,
      hasMany: true,
      virtual: 'place.many',
    },
    {
      name: 'deniedAlias',
      type: 'relationship',
      relationTo: postsSlug,
      virtual: 'place.related',
      access: { read: () => false },
    },
    {
      name: 'limitedAlias',
      type: 'relationship',
      relationTo: postsSlug,
      virtual: 'place.related',
      maxDepth: 0,
    },
    { name: 'titleAlias', type: 'text', virtual: 'place.title' },
  ],
}

export const Media: CollectionConfig = {
  slug: mediaSlug,
  access: { create: () => true, read: () => true },
  upload: { filesRequiredOnCreate: false, disableLocalStorage: true },
  fields: [{ name: 'alt', type: 'text' }],
}
