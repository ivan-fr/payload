import type { Field, FilterOptionsProps, RelationshipField, SanitizedConfig } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { applyBaseFilterToFields } from './applyBaseFilterToFields.js'

const args = {
  relationTo: 'targets',
  req: { user: { id: 1 } },
  user: { id: 1 },
} as unknown as FilterOptionsProps

describe('Lexical relationships to hidden collections (#18121)', () => {
  for (const hidden of [true, () => true, false]) {
    it(`should keep readable selections valid when admin.hidden is ${typeof hidden}`, async () => {
      const fields: Field[] = [{ name: 'related', type: 'relationship', relationTo: 'targets' }]
      const config = {
        collections: [{ slug: 'targets', admin: { hidden } }],
      } as unknown as SanitizedConfig
      const [field] = applyBaseFilterToFields(fields, config) as RelationshipField[]

      expect(await (field!.filterOptions as Function)(args)).toBe(true)
    })
  }

  it('should retain original restrictions and awaited base filters on nested block fields', async () => {
    const baseFilter = vi.fn(async () => ({ tenant: { equals: 7 } }))
    const config = {
      collections: [{ slug: 'targets', admin: { hidden: () => true, baseFilter } }],
    } as unknown as SanitizedConfig
    const [group] = applyBaseFilterToFields(
      [
        {
          name: 'nested',
          type: 'group',
          fields: [
            {
              name: 'related',
              type: 'relationship',
              relationTo: 'targets',
              filterOptions: { active: { equals: true } },
            },
          ],
        },
      ],
      config,
    )
    const field = (group as any).fields[0]

    expect(await field.filterOptions(args)).toEqual({
      and: [{ active: { equals: true } }, { tenant: { equals: 7 } }],
    })
    expect(baseFilter).toHaveBeenCalledWith(expect.objectContaining({ req: args.req }))
  })

  it('should preserve an explicit false filter', async () => {
    const config = { collections: [{ slug: 'targets', admin: {} }] } as unknown as SanitizedConfig
    const [field] = applyBaseFilterToFields(
      [
        {
          name: 'related',
          type: 'relationship',
          relationTo: 'targets',
          filterOptions: () => false,
        },
      ],
      config,
    ) as RelationshipField[]

    expect(await (field!.filterOptions as Function)(args)).toBe(false)
  })
})
