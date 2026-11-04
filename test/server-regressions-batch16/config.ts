import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Posts } from './collections/Posts.js'
import { Users } from './collections/Users.js'
import { usersSlug } from './slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch16',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    admin: { user: usersSlug },
    collections: [Users, Posts],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
