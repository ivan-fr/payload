import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Media } from './collections/Media.js'
import { Posts } from './collections/Posts.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch15',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    collections: [Posts, Media],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
