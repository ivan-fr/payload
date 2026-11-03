import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { defaultPostgresUrl } from '../dbAdapters.js'
import { NoFilesRequired } from '../uploads/collections/NoFilesRequired/index.js'
import { SimpleCollection } from '../locked-documents/collections/Simple/index.js'
import { Users } from '../locked-documents/collections/Users/index.js'
import { usersSlug } from '../locked-documents/slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfigWithDefaults({
  disableAutoLogin: true,
  disableMCP: true,
  suite: 'locked-documents-postgres-pool',
  config: {
    admin: { user: usersSlug },
    collections: [
      Users,
      { ...SimpleCollection, lockDocuments: { duration: 300 } },
      {
        ...NoFilesRequired,
        lockDocuments: { duration: 300 },
        upload: {
          ...(typeof NoFilesRequired.upload === 'object' ? NoFilesRequired.upload : {}),
          staticDir: path.resolve(dirname, 'media/postgres-pool'),
        },
      },
    ],
    db: postgresAdapter({
      pool: {
        connectionString:
          process.env.POSTGRES_URL || process.env.DATABASE_URL || defaultPostgresUrl,
        // Bound acquisition failures so a regression fails instead of hanging the CI worker.
        connectionTimeoutMillis: 2000,
        max: 1,
      },
    }),
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
