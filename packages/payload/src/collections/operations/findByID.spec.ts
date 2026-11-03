import type { FindByIDArgs } from './findByID.js'

import { describe, expect, it, vi } from 'vitest'

import { findByIDOperation } from './findByID.js'

describe('findByID invalid ids', () => {
  function createArgs({ id, disableErrors }: { id: unknown; disableErrors: boolean }) {
    return {
      id,
      collection: { config: { slug: 'posts', flattenedFields: [], hooks: {} } },
      disableErrors,
      overrideAccess: true,
      req: {
        context: {},
        payload: { collections: {}, db: { findOne: vi.fn() } },
        t: (key: string) => key,
      },
    } as unknown as FindByIDArgs
  }

  it.each([null, undefined, '', NaN, Infinity, -Infinity])(
    'should return null for id %s when errors are disabled',
    async (id) => {
      const args = createArgs({ id, disableErrors: true })

      await expect(findByIDOperation(args)).resolves.toBeNull()
      expect(args.req.payload.db.findOne).not.toHaveBeenCalled()
    },
  )

  it.each([null, undefined, '', NaN, Infinity, -Infinity])(
    'should retain the 404 for id %s when errors are enabled',
    async (id) => {
      await expect(
        findByIDOperation(createArgs({ id, disableErrors: false })),
      ).rejects.toMatchObject({ status: 404 })
    },
  )
})
