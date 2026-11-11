import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { importDateFNSLocale } from './importDateFNSLocale.js'
import { hy } from './languages/hy.js'

describe('Armenian date locale (#19481)', () => {
  it('should load the configured Armenian locale and format Armenian months', async () => {
    const locale = await importDateFNSLocale(hy.dateFNSKey)

    expect(locale.code).toBe('hy')
    expect(format(new Date(2026, 0, 2), 'LLLL', { locale })).toBe('հունվար')
  })

  it('should retain the existing unknown-locale result', async () => {
    const locale = await importDateFNSLocale('unknown')

    expect(locale).toBeUndefined()
  })
})
