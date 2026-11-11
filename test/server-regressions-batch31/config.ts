import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Other, Posts } from './collections/index.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch31',
  disableMCP: true,
  config: {
    collections: [Posts, Other],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
