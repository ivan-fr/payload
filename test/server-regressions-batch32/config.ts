import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Pages } from './collections/index.js'
import { pagesSlug } from './slugs.js'

const sqliteIDTypes = {
  sqlite: 'number',
  'sqlite-uuid': 'uuid',
  'sqlite-uuidv7': 'uuidv7',
} as const
const sqliteIDType = sqliteIDTypes[process.env.PAYLOAD_DATABASE as keyof typeof sqliteIDTypes]

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch32',
  disableMCP: true,
  config: {
    ...(sqliteIDType
      ? {
          db: sqliteAdapter({
            client: {
              url: process.env.SQLITE_URL || process.env.DATABASE_URL || 'file:./payload.db',
            },
            autoIncrement: true,
            idType: sqliteIDType,
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
