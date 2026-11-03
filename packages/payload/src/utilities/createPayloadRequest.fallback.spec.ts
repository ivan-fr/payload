import type { Payload, PayloadRequest, TypedFallbackLocale } from '../index.js'

import { describe, expect, it, vi } from 'vitest'

import { createPayloadRequest } from './createPayloadRequest.js'

const payload = {
  config: {
    serverURL: 'http://localhost',
    i18n: { fallbackLanguage: 'en', supportedLanguages: { en: {} }, translations: {} },
    localization: {
      defaultLocale: 'en',
      fallback: true,
      localeCodes: ['en', 'de', 'fr'],
      locales: [{ code: 'en' }, { code: 'de' }, { code: 'fr' }],
    },
  },
  logger: { error: vi.fn() },
} as unknown as Payload

describe('request fallback inheritance (#18768)', () => {
  it.each([
    { fallbackLocale: 'de' },
    { fallbackLocale: false },
    { fallbackLocale: ['de', 'fr'] },
  ] as { fallbackLocale: TypedFallbackLocale }[])(
    'should preserve inherited fallback $fallbackLocale during a local call',
    async ({ fallbackLocale }) => {
      const req = { locale: 'fr', fallbackLocale } as Partial<PayloadRequest>
      const result = await createPayloadRequest({ payload, req })

      expect(result.fallbackLocale).toEqual(fallbackLocale)
      expect(req.fallbackLocale).toEqual(fallbackLocale)
    },
  )

  it('should honor an explicit false override', async () => {
    const result = await createPayloadRequest({
      fallbackLocale: false,
      payload,
      req: { locale: 'fr', fallbackLocale: 'de' },
    })

    expect(result.fallbackLocale).toBe(false)
  })

  it('should use the configured default without an inherited fallback', async () => {
    const result = await createPayloadRequest({ payload, req: { locale: 'fr' } })

    expect(result.fallbackLocale).toBe('en')
  })
})
