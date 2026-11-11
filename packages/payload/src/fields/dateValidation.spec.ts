import type { DateField } from './config/types.js'
import type { DateFieldValidation } from './validations.js'

import { describe, expect, expectTypeOf, it } from 'vitest'

import { date } from './validations.js'

const options = {
  name: 'publishedAt',
  req: { t: (key: string) => key },
  required: true,
  siblingData: {},
} as Parameters<DateFieldValidation>[1]

describe('date validator input (#10605)', () => {
  it('should expose the serialized date string to custom validators', () => {
    expectTypeOf<DateFieldValidation>().parameter(0).toEqualTypeOf<string | null | undefined>()
    const validate: NonNullable<DateField['validate']> = (value) => {
      return value == null || value.startsWith('2026-') || 'Expected a 2026 date'
    }

    expect(validate('2026-11-10T00:00:00.000Z', options)).toBe(true)
    expect(validate('2025-11-10T00:00:00.000Z', options)).toBe('Expected a 2026 date')
  })

  it('should accept ISO strings and reject invalid strings without changing required or timezone validation', () => {
    expect(date('2026-11-10T00:00:00.000Z', options)).toBe(true)
    expect(date('invalid', options)).toBe('validation:notValidDate')
    expect(date(undefined, options)).toBe('validation:required')
    expect(date(null, { ...options, required: false })).toBe(true)
    expect(date('2026-11-10T00:00:00.000Z', { ...options, timezone: true })).toBe(
      'validation:timezoneRequired',
    )
  })
})
