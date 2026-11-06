import { describe, expect, it, vi } from 'vitest'

import { PayloadSDK } from '../index.js'
import { buildSearchParams } from './buildSearchParams.js'

describe('SDK locale fallback (#19387)', () => {
  it('should send explicit false through collection and global requests', async () => {
    const fetch = vi.fn().mockImplementation(async () => Response.json({ id: 1 }))
    const sdk = new PayloadSDK({ baseURL: 'http://localhost/api', fetch })

    await sdk.findByID({ collection: 'posts', id: 1, locale: 'en', fallbackLocale: false })
    await sdk.findGlobal({ slug: 'settings', locale: 'en', fallbackLocale: false })

    for (const [url] of fetch.mock.calls) {
      const params = new URL(url).searchParams
      expect(params.get('locale')).toBe('en')
      expect(params.get('fallback-locale')).toBe('false')
    }
  })

  it.each([undefined, null, ''])('should omit an absent fallback (%s)', (fallbackLocale) => {
    expect(buildSearchParams({ fallbackLocale })).toBe('')
  })

  it('should preserve an explicit fallback locale', () => {
    expect(
      new URLSearchParams(buildSearchParams({ fallbackLocale: 'fr' })).get('fallback-locale'),
    ).toBe('fr')
  })
})
