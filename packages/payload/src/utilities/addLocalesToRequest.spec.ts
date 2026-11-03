import { describe, expect, it } from 'vitest'

import { sanitizeLocales } from './addLocalesToRequest.js'

describe('request locale without translation fallback', () => {
  const localization = {
    defaultLocale: 'de',
    fallback: false,
    localeCodes: ['de', 'en'],
    locales: [
      { code: 'de', label: 'Deutsch' },
      { code: 'en', label: 'English' },
    ],
  }

  it.each([null, undefined, ''])(
    'should use the default locale for a missing locale: %s',
    (locale) => {
      expect(
        sanitizeLocales({
          locale: locale as never,
          fallbackLocale: undefined as never,
          localization,
        }),
      ).toEqual({ locale: 'de', fallbackLocale: false })
    },
  )

  it.each(['de', 'en', 'all'])('should preserve an explicit locale: %s', (locale) => {
    expect(sanitizeLocales({ locale, fallbackLocale: undefined as never, localization })).toEqual({
      locale,
      fallbackLocale: false,
    })
  })

  it('should normalize the wildcard without enabling a fallback locale', () => {
    expect(
      sanitizeLocales({ locale: '*', fallbackLocale: undefined as never, localization }),
    ).toEqual({ locale: 'all', fallbackLocale: false })
  })

  it('should retain existing handling of an invalid explicit locale when fallback is disabled', () => {
    expect(
      sanitizeLocales({ locale: 'invalid', fallbackLocale: undefined as never, localization }),
    ).toEqual({ locale: 'invalid', fallbackLocale: false })
  })
})
