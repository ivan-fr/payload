import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Documents, Pages } from './collections/Blocks.js'
import { Articles, Holders, Notes } from './collections/Joins.js'
import { Categories, Posts } from './collections/Queries.js'
import { UUIDDocuments, UUIDGroups, UUIDUsers } from './collections/UUID.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch38',
  disableMCP: true,
  config: {
    collections: [
      Documents,
      Pages,
      Articles,
      Notes,
      Holders,
      Categories,
      Posts,
      UUIDDocuments,
      UUIDGroups,
      UUIDUsers,
    ],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
