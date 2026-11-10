import { describe, expect, it } from 'vitest'

import { specializeJoinQuery } from './specializeJoinQuery.js'

describe('polymorphic join access projection (#18332)', () => {
  it('should reject a forbidden collection instead of discarding its relationTo predicate', () => {
    expect(
      specializeJoinQuery({
        collection: 'private',
        where: { relationTo: { not_equals: 'private' } },
      }),
    ).toBeNull()
  })
  it('should retain a scoped access predicate only for its own collection', () => {
    const where = {
      or: [{ relationTo: { not_equals: 'private' } }, { visibility: { equals: 'public' } }],
    }
    expect(specializeJoinQuery({ collection: 'private', where })).toEqual({
      or: [{ visibility: { equals: 'public' } }],
    })
    expect(specializeJoinQuery({ collection: 'media', where })).toEqual({})
  })
  it('should preserve user filters when an access OR is true for another collection', () => {
    const where = {
      and: [
        { title: { equals: 'Readable' } },
        { or: [{ relationTo: { not_equals: 'private' } }, { visibility: { equals: 'public' } }] },
      ],
    }
    expect(specializeJoinQuery({ collection: 'media', where })).toEqual({
      and: [{ title: { equals: 'Readable' } }],
    })
  })
  it('should preserve OR alternatives without narrowing all branches to one relation', () => {
    const where = { or: [{ relationTo: { equals: 'media' } }, { title: { equals: 'Allowed' } }] }
    expect(specializeJoinQuery({ collection: 'media', where })).toEqual({})
    expect(specializeJoinQuery({ collection: 'private', where })).toEqual({
      or: [{ title: { equals: 'Allowed' } }],
    })
  })
  it('should compose include, exclude and unsatisfiable clauses', () => {
    expect(
      specializeJoinQuery({
        collection: 'media',
        where: { relationTo: { in: ['media', 'private'], not_in: ['private'] } },
      }),
    ).toEqual({})
    expect(
      specializeJoinQuery({
        collection: 'private',
        where: { and: [{ relationTo: { equals: 'media' } }, { title: { equals: 'Allowed' } }] },
      }),
    ).toBeNull()
    expect(() =>
      specializeJoinQuery({ collection: 'media', where: { relationTo: { unsupported: true } } }),
    ).toThrow()
  })
})
