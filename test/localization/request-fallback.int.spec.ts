import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { defaultLocale as englishLocale, localizedPostsSlug, spanishLocale } from './shared.js'

test.suite('Local API request fallback (#18768)', { config: './config.ts' }, () => {
  test('should read fallback data without replacing the caller request fallback', async ({
    payload,
  }) => {
    const post = await payload.create({
      overrideAccess: true,
      collection: localizedPostsSlug,
      data: { title: 'Solo en español' },
      locale: spanishLocale,
    })
    const req = await createPayloadRequest({
      payload,
      locale: englishLocale,
      fallbackLocale: spanishLocale,
    })
    const result = await payload.findByID({
      collection: localizedPostsSlug,
      id: post.id,
      overrideAccess: true,
      req,
    })

    expect(result.title).toBe('Solo en español')
    expect(req.fallbackLocale).toBe(spanishLocale)
  })
})
