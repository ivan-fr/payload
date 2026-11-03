import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { searchPlugin } from '@payloadcms/plugin-search'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Indexed, Posts } from './collections/Posts.js'
import { indexedSlug } from './slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch11',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    ...(process.env.PAYLOAD_DATABASE === 'sqlite'
      ? {
          db: sqliteAdapter({
            client: {
              url: process.env.SQLITE_URL || process.env.DATABASE_URL || 'file:./payload.db',
            },
            autoIncrement: true,
            transactionOptions: { behavior: 'immediate' },
          }),
        }
      : {}),
    collections: [Posts, Indexed],
    blocks: [{ slug: 'shared', fields: [{ name: 'heading', type: 'text' }] }],
    plugins: [
      searchPlugin({
        collections: [indexedSlug],
        skipSync: ({ req }) => req.context.skipSearch === true,
        searchOverrides: {
          fields: ({ defaultFields }) => [
            ...defaultFields,
            { name: 'dedupeKey', type: 'text', unique: true },
          ],
        },
        beforeSync: ({ searchDoc }) => ({ ...searchDoc, dedupeKey: 'same-key' }),
      }),
    ],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
