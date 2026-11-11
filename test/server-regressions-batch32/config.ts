import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { autoLoginEmail, usersSlug } from './slugs.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch32',
  disableMCP: true,
  config: {
    admin: {
      autoLogin: { email: autoLoginEmail },
      user: usersSlug,
    },
    collections: [
      {
        slug: usersSlug,
        auth: true,
        fields: [],
      },
    ],
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
