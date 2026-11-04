import type { FilterOptionsProps } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { parentFilterOptions } from './parentFilterOptions.js'

describe('parent filter (#17658)', () => {
  it.each([0, 11])(
    'should exclude the subtree by IDs even with cyclic or stale breadcrumbs: %s',
    async (rootID) => {
      const find = vi
        .fn()
        .mockResolvedValueOnce({ docs: [{ id: 2 }, { id: 3 }] })
        .mockResolvedValueOnce({ docs: [{ id: 4 }, { id: rootID }] })
        .mockResolvedValueOnce({ docs: [] })
      const args = {
        id: rootID,
        relationTo: 'pages',
        req: { payload: { find } },
      } as unknown as FilterOptionsProps
      const filter = parentFilterOptions('trail', {
        parentFieldSlug: 'ancestor',
      })
      expect(await filter(args)).toEqual({ id: { not_in: [rootID, 2, 3, 4] } })
      expect(find).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          collection: 'pages',
          req: args.req,
          overrideAccess: true,
          pagination: false,
          where: { ancestor: { in: [rootID] } },
        }),
      )
      expect(find).toHaveBeenCalledTimes(3)
    },
  )

  it('should leave new documents unrestricted without querying', async () => {
    const find = vi.fn()
    expect(
      await parentFilterOptions()({
        req: { payload: { find } },
      } as unknown as FilterOptionsProps),
    ).toBe(true)
    expect(find).not.toHaveBeenCalled()
  })
})
