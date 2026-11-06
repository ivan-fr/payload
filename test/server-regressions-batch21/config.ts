import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Users } from './collections/Users.js'
import { Settings } from './globals/Settings.js'
import { usersSlug } from './slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch21',
  disableMCP: true,
  disableAutoLogin: true,
  config: {
    admin: { user: usersSlug },
    collections: [Users],
    globals: [Settings],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
