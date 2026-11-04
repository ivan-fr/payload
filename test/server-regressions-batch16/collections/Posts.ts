import type { CollectionConfig, TextFieldSingleValidation } from 'payload'

import { HeadingFeature, lexicalEditor, ParagraphFeature } from '@payloadcms/richtext-lexical'

import { postsSlug, usersSlug } from '../slugs.js'

const validatePath: TextFieldSingleValidation = (_value, { path }) =>
  Array.isArray(path) ? true : 'Missing validation path'

export const Posts: CollectionConfig = {
  slug: postsSlug,
  admin: {
    baseFilter: () => ({ archived: { not_equals: true } }),
    pagination: { defaultLimit: 2, limits: [2, 5, 10] },
  },
  access: {
    read: () => true,
    update: ({ req }) => (req.user?.role === 'editor' ? { owner: { equals: req.user.id } } : false),
  },
  versions: { drafts: { schedulePublish: true } },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'owner', type: 'relationship', relationTo: usersSlug, required: true },
    { name: 'archived', type: 'checkbox' },
    {
      name: 'body',
      type: 'richText',
      required: true,
      editor: lexicalEditor({
        features: [ParagraphFeature(), HeadingFeature({ enabledHeadingSizes: ['h2'] })],
      }),
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'text',
          type: 'text',
          validate: validatePath,
        },
      ],
    },
  ],
}
