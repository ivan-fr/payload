import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { importDateFNSLocale } from './importDateFNSLocale.js'
import { hy } from './languages/hy.js'

describe('Armenian date locale (#19481)', () => {
  it('should format dates using the configured Armenian locale', async () => {
    const locale = await importDateFNSLocale(hy.dateFNSKey)

    expect(locale?.code).toBe('hy')
    expect(format(new Date(2026, 10, 11), 'MMMM', { locale })).toBe('նոյեմբեր')
  })
})
