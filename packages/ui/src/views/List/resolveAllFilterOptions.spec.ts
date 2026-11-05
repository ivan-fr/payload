import type { Field, PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { resolveAllFilterOptions } from './resolveAllFilterOptions.js'

const req = { user: { id: 1, collection: 'users' } } as unknown as PayloadRequest

describe('virtual relationship filter option paths (#18215)', () => {
  for (const type of ['relationship', 'upload'] as const) {
    it(`should resolve ${type} restrictions under its virtual path at the root and inside named layouts`, async () => {
      const filter = vi.fn(async () => ({ allowed: { equals: true } }))
      const fields: Field[] = [
        {
          name: 'region',
          type,
          relationTo: 'regions',
          virtual: 'customer.region',
          filterOptions: filter,
        },
        {
          name: 'direct',
          type,
          relationTo: 'regions',
          filterOptions: { active: { equals: true } },
        },
        {
          name: 'details',
          type: 'group',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'region',
                  type,
                  relationTo: 'regions',
                  virtual: 'customer.region',
                  filterOptions: filter,
                },
              ],
            },
          ],
        },
        {
          type: 'tabs',
          tabs: [
            {
              name: 'billing',
              fields: [
                {
                  name: 'region',
                  type,
                  relationTo: 'regions',
                  virtual: 'customer.region',
                  filterOptions: false,
                },
              ],
            },
          ],
        },
      ]
      const result = await resolveAllFilterOptions({ fields, req })

      expect(result.get('customer.region')).toEqual({ regions: { allowed: { equals: true } } })
      expect(result.get('details.customer.region')).toEqual({
        regions: { allowed: { equals: true } },
      })
      expect(result.get('billing.customer.region')).toEqual({ regions: { id: { exists: false } } })
      expect(result.get('direct')).toEqual({ regions: { active: { equals: true } } })
      expect(result.has('region')).toBe(false)
      expect(filter).toHaveBeenCalledWith(
        expect.objectContaining({ req, user: req.user, relationTo: 'regions' }),
      )
    })
  }
})
