import { describe, expect, it } from 'vitest'

import { InvalidConfiguration } from '../errors/index.js'
import { assertValidLocales } from './assertValidLocales.js'

describe('assertValidLocales', () => {
  it.each([
    { locales: ['en', 'fr'], name: 'locale codes' },
    {
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: { en: 'French', fr: 'Français' } },
      ],
      name: 'locale objects',
    },
  ])('should accept $name', ({ locales }) => {
    expect(() => assertValidLocales({ locales })).not.toThrow()
  })

  it('should name the locale object that uses "value" instead of "code"', () => {
    const locales = [
      { code: 'en', label: 'English' },
      { label: 'French', value: 'fr' },
    ]

    expect(() => assertValidLocales({ locales })).toThrow(InvalidConfiguration)
    expect(() => assertValidLocales({ locales })).toThrow(
      'localization.locales[1] is missing a "code"',
    )
    expect(() => assertValidLocales({ locales })).toThrow('did you mean "code"?')
  })

  it.each([
    { locales: [{ label: 'English' }], name: 'an object without a code' },
    { locales: [{ code: '', label: 'English' }], name: 'an empty code' },
    { locales: [{ code: 'en', label: 'English' }, 'fr'], name: 'a string among objects' },
    { locales: [{ code: 'en', label: 'English' }, null], name: 'a null entry' },
  ])('should reject $name', ({ locales }) => {
    expect(() => assertValidLocales({ locales })).toThrow('is missing a "code"')
  })

  it('should reject an object among locale codes', () => {
    expect(() => assertValidLocales({ locales: ['en', { code: 'fr', label: 'French' }] })).toThrow(
      'localization.locales[1] must be a non-empty string',
    )
  })

  it.each([{ locales: [] }, { locales: undefined }])(
    'should leave missing locales to the existing defaults: $locales',
    ({ locales }) => {
      expect(() => assertValidLocales({ locales })).not.toThrow()
    },
  )
})
