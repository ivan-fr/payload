import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import {
  articlesSlug,
  authorsSlug,
  documentsSlug,
  organizationsSlug,
  postsSlug,
  usersSlug,
} from './slugs.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch33',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    admin: { user: usersSlug },
    collections: [
      {
        slug: usersSlug,
        auth: true,
        fields: [],
      },
      {
        slug: postsSlug,
        fields: [
          { name: 'title', type: 'text' },
          {
            name: 'category',
            type: 'text',
            access: { update: () => false },
            required: true,
          },
          {
            name: 'internalNote',
            type: 'text',
            access: { update: () => false },
          },
        ],
        versions: true,
      },
      {
        slug: organizationsSlug,
        fields: [{ name: 'name', type: 'text' }],
      },
      {
        slug: authorsSlug,
        defaultPopulate: { name: true, organizationName: true },
        fields: [
          { name: 'name', type: 'text' },
          { name: 'bio', type: 'text' },
          { name: 'organization', type: 'relationship', relationTo: organizationsSlug },
          { name: 'organizationName', type: 'text', virtual: 'organization.name' },
        ],
      },
      {
        slug: articlesSlug,
        fields: [
          { name: 'title', type: 'text' },
          { name: 'author', type: 'relationship', relationTo: authorsSlug },
        ],
      },
      {
        slug: documentsSlug,
        fields: [
          { name: 'title', type: 'text' },
          { name: 'featured', type: 'relationship', hasMany: true, relationTo: organizationsSlug },
          {
            name: 'rows',
            type: 'array',
            fields: [
              { name: 'label', type: 'text' },
              {
                name: 'related',
                type: 'relationship',
                hasMany: true,
                relationTo: organizationsSlug,
              },
              { name: 'owner', type: 'relationship', relationTo: [organizationsSlug, authorsSlug] },
              { name: 'tags', type: 'text', hasMany: true },
              { name: 'scores', type: 'number', hasMany: true },
            ],
          },
          {
            name: 'rows_extra',
            type: 'array',
            fields: [{ name: 'tags', type: 'text', hasMany: true }],
          },
          {
            name: 'layout',
            type: 'blocks',
            blocks: [
              {
                slug: 'content',
                fields: [
                  { name: 'label', type: 'text' },
                  {
                    name: 'related',
                    type: 'relationship',
                    hasMany: true,
                    relationTo: organizationsSlug,
                  },
                  {
                    name: 'owner',
                    type: 'relationship',
                    relationTo: [organizationsSlug, authorsSlug],
                  },
                  { name: 'tags', type: 'text', hasMany: true },
                  { name: 'scores', type: 'number', hasMany: true },
                ],
              },
            ],
          },
        ],
      },
    ],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
