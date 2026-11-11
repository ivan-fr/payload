import type { DateField, DateFieldValidation } from 'payload'

import { describe, expect, test } from 'tstyche'

describe('serialized date validation (#10605)', () => {
  test('should receive serialized strings instead of Date objects', () => {
    expect<Parameters<DateFieldValidation>[0]>().type.toBe<null | string | undefined>()
    const validate: NonNullable<DateField['validate']> = (value) => {
      return value == null || value.startsWith('2026-') || 'Expected a 2026 date'
    }

    expect(validate).type.toBeAssignableTo<DateFieldValidation>()
  })
})
