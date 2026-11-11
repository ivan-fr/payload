import type { ClientConfig } from 'payload'

import * as qs from 'qs-esm'
import { describe, expect, it } from 'vitest'

import { getNoFallbackLocaleParam } from './getNoFallbackLocaleParam.js'

const localization = {
  defaultLocale: 'en',
  localeCodes: ['en', 'de'],
  locales: [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'German' },
  ],
} as unknown as ClientConfig['localization']

describe('getNoFallbackLocaleParam', () => {
  it('should disable locale fallback when localization is configured', () => {
    expect(getNoFallbackLocaleParam({ localization })).toBe('null')
  })

  it.each([false, undefined] as const)(
    'should omit the param when localization is %s',
    (unconfiguredLocalization) => {
      const fallbackLocale = getNoFallbackLocaleParam({ localization: unconfiguredLocalization })

      expect(fallbackLocale).toBeUndefined()
      expect(qs.stringify({ depth: 0, 'fallback-locale': fallbackLocale })).toBe('depth=0')
    },
  )
})
