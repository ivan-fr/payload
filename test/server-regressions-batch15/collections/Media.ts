import type { CollectionConfig } from 'payload'

import { mediaSlug } from '../slugs.js'

export const Media: CollectionConfig = {
  slug: mediaSlug,
  access: { read: ({ req }) => req.user != null },
  upload: {
    disableLocalStorage: true,
    mimeTypes: ['video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'image/png'],
  },
  fields: [{ name: 'title', type: 'text' }],
}
