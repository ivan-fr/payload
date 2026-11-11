import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { ContextItems, Defaults, Names } from './collections/index.js'

const sqliteIDTypes = {
  sqlite: 'number',
  'sqlite-uuid': 'uuid',
  'sqlite-uuidv7': 'uuidv7',
} as const
const sqliteIDType = sqliteIDTypes[process.env.PAYLOAD_DATABASE as keyof typeof sqliteIDTypes]

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch36',
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
    collections: [ContextItems, Defaults, Names],
    localization: { defaultLocale: 'en', locales: ['en', 'fr'], fallback: false },
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
