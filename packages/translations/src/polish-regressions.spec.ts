import { describe, expect, it } from 'vitest'

import { enTranslations } from './languages/en.js'
import { plTranslations } from './languages/pl.js'

const flatten = ({
  object,
  prefix = '',
}: {
  object: object
  prefix?: string
}): Record<string, string> =>
  Object.fromEntries(
    Object.entries(object).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return typeof value === 'string'
        ? [[path, value]]
        : Object.entries(flatten({ object: value, prefix: path }))
    }),
  )
const placeholders = ({ value }: { value: string }) =>
  [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]).sort()

describe('Polish admin translations', () => {
  it('should retain English interpolation tokens and provide nonempty messages', () => {
    const english = flatten({ object: enTranslations })
    const polish = flatten({ object: plTranslations })

    for (const [path, value] of Object.entries(polish)) {
      expect(value.trim(), path).not.toBe('')
      expect(placeholders({ value }), path).toEqual(placeholders({ value: english[path] ?? '' }))
    }
  })

  it('should describe numeric validation and the maximum count correctly', () => {
    expect(plTranslations.validation.enterNumber).toBe('Wprowadź poprawną liczbę.')
    expect(plTranslations.validation.requiresNoMoreThan).toBe(
      'To pole może zawierać co najwyżej {{count}} {{label}}.',
    )
  })

  it('should use action and state labels suitable for admin controls', () => {
    expect(plTranslations.general).toMatchObject({
      clear: 'Wyczyść',
      moving: 'Przenoszenie',
      none: 'Brak',
      trash: 'Kosz',
    })
    expect(plTranslations.version.noRowsSelected).toBe('Nie wybrano: {{label}}')
  })
})
