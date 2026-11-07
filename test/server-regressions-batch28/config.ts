import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Collisions } from './collections/Collisions.js'
import { Values } from './collections/Values.js'
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch28',
  disableMCP: true,
  config: {
    collections: [Collisions, Values],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
