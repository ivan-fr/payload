import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Posts, Places, Events, Media } from './collections/index.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch5',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    collections: [Posts, Places, Events, Media],
    ...(process.env.PAYLOAD_DATABASE?.startsWith('sqlite')
      ? {
          db: sqliteAdapter({
            client: { url: process.env.SQLITE_URL || 'file:/tmp/payload-batch5.db' },
            transactionOptions: { behavior: 'deferred' },
          }),
        }
      : {}),
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
