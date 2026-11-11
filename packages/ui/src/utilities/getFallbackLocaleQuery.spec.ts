import * as qs from 'qs-esm'
import { expect, it } from 'vitest'

import { sanitizeFallbackLocale } from '../../../payload/src/utilities/sanitizeFallbackLocale.js'
import { getFallbackLocaleQuery } from './getFallbackLocaleQuery.js'

it('should disable configured server fallback after serializing a localized write (#17778)', () => {
  const localization = {
    defaultLocale: 'en',
    fallback: true,
    localeCodes: ['en', 'fr'],
    locales: [
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'French' },
    ],
  }
  const query = new URLSearchParams(
    qs.stringify({
      'fallback-locale': getFallbackLocaleQuery({ localization: localization as never }),
    }),
  )
  expect(
    sanitizeFallbackLocale({
      locale: 'fr',
      localization: localization as never,
      fallbackLocale: query.get('fallback-locale') as never,
    }),
  ).toBe(false)
  expect(
    sanitizeFallbackLocale({
      locale: 'fr',
      localization: localization as never,
      fallbackLocale: undefined,
    }),
  ).toBe('en')
})
