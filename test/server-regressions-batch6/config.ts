import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Posts, Restricted } from './collections/index.js'
import { restrictedSlug, settingsSlug } from './slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch6',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    localization: { defaultLocale: 'en', locales: ['en', 'fr'], fallback: false },
    collections: [Posts, Restricted],
    globals: [
      {
        slug: settingsSlug,
        graphQL: { name: 'BatchSixSettings' },
        access: { read: () => true, update: () => true },
        fields: [
          {
            name: 'link',
            type: 'relationship',
            relationTo: restrictedSlug,
            filterOptions: () => ({ allowed: { equals: true } }),
          },
        ],
      },
    ],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
