import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Posts } from './collections/Posts.js'
import { Users } from './collections/Users.js'

export default buildConfigWithDefaults({
  suite: 'plugin-import-export-batch30',
  disableMCP: true,
  config: {
    collections: [Posts, Users],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
