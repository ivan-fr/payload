import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Fields, Folders, Public, Restricted, Transactions } from './collections/index.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch30',
  disableMCP: true,
  config: {
    collections: [Fields, Folders, Public, Restricted, Transactions],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
