import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Labels, Media, Posts } from './collections/index.js'
import { settingsSlug } from './slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch9',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    localization: { defaultLocale: 'en', locales: ['en', 'fr'], fallback: false },
    collections: [Posts, Media, Labels],
    globals: [
      {
        slug: settingsSlug,
        versions: { drafts: true, max: 100 },
        access: { read: () => true, update: () => true },
        fields: [{ name: 'title', type: 'text' }],
      },
    ],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
