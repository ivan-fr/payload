import { describe, expect, it } from 'vitest'

import { baseTimezoneField } from './baseField.js'

describe('timezone empty values (#16283)', () => {
  it.each([
    ['', null],
    [null, null],
    [undefined, undefined],
    ['Europe/Paris', 'Europe/Paris'],
  ])('should normalize only the empty string: %s', async (value, expected) => {
    const field = baseTimezoneField({
      name: 'date_tz',
      options: ['Europe/Paris'],
      defaultValue: 'Europe/Paris',
      required: true,
    })
    const hook = field.hooks!.beforeValidate![0]!
    expect(await hook({ value } as never)).toBe(expected)
    expect(field).toMatchObject({ defaultValue: 'Europe/Paris', required: true })
  })
})
