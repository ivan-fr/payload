import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Notes } from './collections/Notes.js'
import { Pages } from './collections/Pages.js'
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch27',
  disableMCP: true,
  config: {
    collections: [Pages, Notes],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
