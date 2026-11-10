import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Media, People, Reports } from './collections/index.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch33',
  disableMCP: true,
  config: {
    collections: [People, Reports, Media],
    upload: { transformers: [] },
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
