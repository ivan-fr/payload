import { describe, expect, it } from 'vitest'

import { parseParams } from './parseParams/index.js'
import { sanitizeJoinParams } from './sanitizeJoinParams.js'

describe('whole-request join suppression (#17929)', () => {
  it.each([false, 'false'] as const)('should preserve %s as a global join opt-out', (joins) => {
    expect(sanitizeJoinParams(joins)).toBe(false)
    expect(parseParams({ joins }).joins).toBe(false)
  })

  it('should retain per-field controls and numeric query parameters', () => {
    expect(
      sanitizeJoinParams({ related: false, children: { limit: '3', sort: '-title' } }),
    ).toEqual({
      related: false,
      children: { count: false, limit: 3, page: undefined, sort: '-title', where: undefined },
    })
    expect(sanitizeJoinParams()).toEqual({})
  })
})
