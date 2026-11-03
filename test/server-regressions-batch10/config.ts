import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { MetaTitleField } from '@payloadcms/plugin-seo/fields'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { Pages } from './collections/Pages.js'
import { pagesSlug, restrictedSlug, settingsSlug, unrelatedSlug } from './slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfigWithDefaults({
  suite: 'server-regressions-batch10',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    collections: [Pages],
    globals: [
      {
        slug: settingsSlug,
        access: { read: () => true },
        fields: [
          { type: 'group', name: 'meta', fields: [MetaTitleField({ hasGenerateFn: true })] },
        ],
      },
      {
        slug: restrictedSlug,
        access: { read: () => false },
        fields: [MetaTitleField({ hasGenerateFn: true })],
      },
      { slug: unrelatedSlug, fields: [{ name: 'title', type: 'text' }] },
    ],
    plugins: [
      nestedDocsPlugin({ collections: [pagesSlug], generateLabel: (_, doc) => String(doc.title) }),
      formBuilderPlugin({ fields: { payment: false } }),
      seoPlugin({
        generateTitle: () => 'Generated title',
        generateDescription: () => 'Generated description',
        generateURL: () => 'https://example.com',
        generateImage: () => 'image-id',
      }),
    ],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
