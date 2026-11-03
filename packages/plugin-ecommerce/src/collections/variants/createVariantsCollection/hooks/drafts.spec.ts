import type { PayloadRequest, Validate } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { validateOptions } from './validateOptions.js'

function harness({
  siblings = [],
}: { siblings?: { id: number | string; options: string[] }[] } = {}) {
  const findByID = vi.fn().mockImplementation(async ({ draft }) => ({
    variantTypes: ['size'],
    variants: { docs: draft ? siblings : [{ id: 'old-published', options: ['small'] }] },
  }))
  const req = { payload: { findByID }, t: (key: string) => key } as unknown as PayloadRequest
  return { req, findByID }
}

describe('latest-draft variant validation (#19020)', () => {
  it('should allow an option freed by a sibling draft', async () => {
    const { req } = harness({ siblings: [{ id: 'sibling', options: ['large'] }] })
    expect(
      await validateOptions()(['small'], {
        data: { product: 'product' },
        req,
      } as Parameters<Validate>[1]),
    ).toBe(true)
  })

  it('should reject a combination occupied in the latest draft', async () => {
    const { req } = harness({ siblings: [{ id: 'sibling', options: ['large'] }] })
    expect(
      await validateOptions()(['large'], {
        data: { product: 'product' },
        req,
      } as Parameters<Validate>[1]),
    ).toBe('ecommerce:variantOptionsAlreadyExists')
  })

  it('should exclude the current variant even when a draft join returns it with a differently typed ID', async () => {
    const { req } = harness({ siblings: [{ id: 7, options: ['small'] }] })
    expect(
      await validateOptions()(['small'], {
        data: { id: '7', product: 'product' },
        req,
      } as Parameters<Validate>[1]),
    ).toBe(true)
  })
})
