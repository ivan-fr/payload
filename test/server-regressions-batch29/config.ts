import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Articles } from './collections/Articles.js'
import { previewFields, PreviewPages } from './collections/PreviewPages.js'
import { Targets } from './collections/Targets.js'
import { previewGlobalSlug } from './slugs.js'

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch29',
  disableMCP: true,
  config: {
    collections: [Articles, PreviewPages, Targets],
    globals: [
      {
        slug: previewGlobalSlug,
        access: { read: () => true },
        fields: structuredClone(previewFields),
      },
    ],
    localization: { locales: ['en', 'fr'], defaultLocale: 'en' },
    typescript: {
      autoGenerate: false,
      outputFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'payload-types.ts'),
    },
  },
})
