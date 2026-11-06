import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { postsSlug } from './collections/Posts.js'

test.suite('SDK explicit locale fallback (#19387)', { config: './config.ts' }, () => {
  test('should suppress configured collection fallback through the REST API', async ({
    payload,
    sdk,
  }) => {
    const doc = await payload.create({
      collection: postsSlug,
      data: { localizedText: 'English source' },
      locale: 'en',
      overrideAccess: true,
    })

    const fallback = await sdk.findByID({ collection: postsSlug, id: doc.id, locale: 'es' })
    const noFallback = await sdk.findByID({
      collection: postsSlug,
      id: doc.id,
      locale: 'es',
      fallbackLocale: false,
    })

    expect(fallback.localizedText).toBe('English source')
    expect(noFallback.localizedText).toBeUndefined()
  })

  test('should suppress configured global fallback through the REST API', async ({
    payload,
    sdk,
  }) => {
    await payload.updateGlobal({
      slug: 'global',
      data: { localizedText: 'English global' },
      locale: 'en',
      overrideAccess: true,
    })

    const fallback = await sdk.findGlobal({ slug: 'global', locale: 'es' })
    const noFallback = await sdk.findGlobal({ slug: 'global', locale: 'es', fallbackLocale: false })

    expect(fallback.localizedText).toBe('English global')
    expect(noFallback.localizedText).toBeUndefined()
  })
})
