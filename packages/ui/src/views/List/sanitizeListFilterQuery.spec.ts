import type { FlattenedField, Where } from 'payload'

import { describe, expect, it } from 'vitest'

import { sanitizeListFilterQuery } from './sanitizeListFilterQuery.js'

const fields = [
  { name: 'mode', type: 'select', options: ['online'] },
  { name: 'author', type: 'relationship', relationTo: 'users' },
  { name: 'image', type: 'upload', relationTo: 'media' },
  { name: 'title', type: 'text' },
  {
    name: 'meta',
    type: 'group',
    flattenedFields: [{ name: 'mode', type: 'select', options: ['online'] }],
  },
] as FlattenedField[]

describe('Admin picker filter drafts', () => {
  it('should omit blank picker clauses without changing the rows passed to the UI', () => {
    const where: Where = {
      or: [
        {
          and: [
            { mode: { equals: '' } },
            { author: { equals: '' } },
            { image: { equals: undefined } },
            { 'meta.mode': { equals: '' } },
          ],
        },
      ],
    }
    const before = structuredClone(where)
    expect(sanitizeListFilterQuery({ fields, where })).toEqual({})
    expect(where).toEqual(before)
  })

  it('should retain null, zero, false, valid and invalid nonempty values for normal validation', () => {
    const where: Where = {
      and: [
        { mode: { equals: null } },
        { author: { equals: 0 } },
        { image: { exists: false } },
        { mode: { in: ['online', 'invalid'] } },
        { title: { equals: '' } },
      ],
    }
    expect(sanitizeListFilterQuery({ fields, where })).toEqual(where)
  })

  it('should prune a draft operator while keeping the remaining predicate and sibling constraints', () => {
    const where: Where = {
      or: [
        { and: [{ mode: { equals: '', exists: false } }, { mode: { equals: 'online' } }] },
        { and: [{ author: { equals: '' } }] },
      ],
    }
    expect(sanitizeListFilterQuery({ fields, where })).toEqual({
      or: [{ and: [{ mode: { exists: false } }, { mode: { equals: 'online' } }] }],
    })
  })
})
