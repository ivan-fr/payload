import type { ClientCollectionConfig } from 'payload'

import { describe, expect, it } from 'vitest'

import { getRelationshipSearchWhere } from './getRelationshipSearchWhere.js'

const numeric = {
  slug: 'stories',
  admin: { useAsTitle: 'number' },
  fields: [{ name: 'number', type: 'number' }],
} as ClientCollectionConfig
const text = {
  slug: 'patterns',
  admin: { useAsTitle: 'name' },
  fields: [{ name: 'name', type: 'text' }],
} as ClientCollectionConfig

describe('numeric polymorphic relationship search (#15686)', () => {
  it('should skip an unmatchable numeric branch while keeping later text collections searchable', () => {
    expect(
      [numeric, text].map((collection) =>
        getRelationshipSearchWhere({ collection, search: 'pattern' }),
      ),
    ).toEqual([false, { name: { like: 'pattern' } }])
  })
  it.each(['0', '-5', '12.5'])('should compare a numeric title using equality: %s', (search) => {
    expect(getRelationshipSearchWhere({ collection: numeric, search })).toEqual({
      number: { equals: Number(search) },
    })
  })
  it.each(['Infinity', 'NaN', '12cats'])(
    'should reject non-finite or partially numeric terms: %s',
    (search) => {
      expect(getRelationshipSearchWhere({ collection: numeric, search })).toBe(false)
    },
  )
  it('should recognize nested titles and preserve textual numeric-looking IDs', () => {
    const grouped = {
      ...numeric,
      admin: { useAsTitle: 'meta.code' },
      fields: [{ name: 'meta', type: 'group', fields: [{ name: 'code', type: 'number' }] }],
    } as ClientCollectionConfig
    expect(getRelationshipSearchWhere({ collection: grouped, search: 'abc' })).toBe(false)
    expect(getRelationshipSearchWhere({ collection: text, search: '001' })).toEqual({
      name: { like: '001' },
    })
    expect(getRelationshipSearchWhere({ collection: numeric })).toBeUndefined()
  })
})
