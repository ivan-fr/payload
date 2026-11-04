import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { OtherUsers } from './collections/OtherUsers.js'
import { Users } from './collections/Users.js'
import { usersSlug } from './slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch18',
  disableMCP: true,
  disableAutoLogin: true,
  config: {
    admin: { user: usersSlug },
    collections: [Users, OtherUsers],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
