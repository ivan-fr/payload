import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Localized, Products, Variants } from './collections/index.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch7',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    localization: { defaultLocale: 'en', locales: ['en', 'fr'], fallback: false },
    collections: [Products, Variants, Localized],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
