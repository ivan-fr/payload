import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Pages } from './collections/Pages.js'
import { Posts } from './collections/Posts.js'
import { Tags } from './collections/Tags.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch17',
  disableMCP: true,
  config: {
    collections: [Tags, Posts, Pages],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
