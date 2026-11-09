import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Pages } from './collections/index.js'
import { pagesSlug } from './slugs.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch32',
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
    collections: [Pages],
    plugins: [
      nestedDocsPlugin({ collections: [pagesSlug], generateLabel: (_, doc) => String(doc.title) }),
    ],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
