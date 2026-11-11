import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../../buildConfigWithDefaults.js'
import { UUIDDocuments, UUIDGroups, UUIDUsers } from '../collections/UUID.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch38-uuid',
  disableMCP: true,
  config: {
    db: sqliteAdapter({
      client: { url: process.env.SQLITE_URL ?? 'file:/tmp/payload-batch31-uuid.db' },
      idType: 'uuid',
    }),
    collections: [UUIDDocuments, UUIDGroups, UUIDUsers],
    typescript: {
      autoGenerate: false,
      declare: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
