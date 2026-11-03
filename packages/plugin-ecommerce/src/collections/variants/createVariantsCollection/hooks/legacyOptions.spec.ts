import type { PayloadRequest, Validate } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { validateOptions } from './validateOptions.js'

const harness = (siblings: Record<string, unknown>[] = []) => {
  const findByID = vi
    .fn()
    .mockResolvedValue({ variantTypes: ['size'], variants: { docs: siblings } })
  const req = { payload: { findByID }, t: (key: string) => key } as unknown as PayloadRequest
  const options = { data: { id: 'current', product: 'shirt' }, req } as Parameters<Validate>[1]

  return { findByID, options }
}

describe('variant validation with disabled trash (#16367)', () => {
  it('should query siblings without requiring the optional deletedAt field', async () => {
    const { findByID, options } = harness()

    expect(await validateOptions()(['small'], options)).toBe(true)
    expect(findByID.mock.calls[0][0].joins.variants.where).toEqual({
      id: { not_equals: 'current' },
    })
  })
})

describe('legacy sibling variant options (#16368)', () => {
  it.each([undefined, null, 'legacy'])(
    'should skip malformed options %s and allow a new combination',
    async (value) => {
      const { options } = harness([
        { id: 'legacy', options: value },
        { id: 'valid', options: ['large'] },
      ])

      expect(await validateOptions()(['small'], options)).toBe(true)
    },
  )

  it('should still reject a duplicate after malformed sibling rows', async () => {
    const { options } = harness([{ id: 'legacy' }, { id: 'valid', options: ['small'] }])

    expect(await validateOptions()(['small'], options)).toBe(
      'ecommerce:variantOptionsAlreadyExists',
    )
  })
})
