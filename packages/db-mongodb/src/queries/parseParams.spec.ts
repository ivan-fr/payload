import type { FlattenedField, Payload, Where } from 'payload'

import { describe, expect, it } from 'vitest'

import { parseParams } from './parseParams.js'

const fields = [
  { name: 'title', type: 'text' },
  { name: 'score', type: 'number' },
] as FlattenedField[]

describe('MongoDB implicit and explicit query conjunctions (#18355)', () => {
  it.each([false, true])(
    'should preserve preceding conditions (and first: %s)',
    async (isAndFirst) => {
      const range: Where = { score: { greater_than_equal: 2, less_than_equal: 4 } }
      const explicit: Where = { and: [{ title: { equals: 'needle' } }] }
      const result = await parseParams({
        fields,
        parentIsLocalized: false,
        payload: { config: {}, collections: {} } as Payload,
        where: isAndFirst ? { ...explicit, ...range } : { ...range, ...explicit },
      })

      expect(result.$and).toEqual(
        expect.arrayContaining([
          { score: { $gte: 2 } },
          { score: { $lte: 4 } },
          { title: { $eq: 'needle' } },
        ]),
      )
    },
  )

  it('should conjoin differently-cased OR groups rather than overwrite an earlier group', async () => {
    const result = await parseParams({
      fields,
      parentIsLocalized: false,
      payload: { config: {}, collections: {} } as Payload,
      where: {
        or: [{ title: { equals: 'first' } }],
        OR: [{ title: { equals: 'second' } }],
      },
    })

    expect(result.$and).toEqual(
      expect.arrayContaining([
        { $or: [{ title: { $eq: 'first' } }] },
        { $or: [{ title: { $eq: 'second' } }] },
      ]),
    )
  })
})
