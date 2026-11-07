import type { Field } from 'payload'

import { describe, expect, it } from 'vitest'

import { getGroupByFieldPaths, resolveGroupBy } from './getGroupByFieldPaths.js'

const fields: Field[] = [
  { name: 'id', type: 'text' },
  { name: 'title', type: 'text' },
  { name: 'links', type: 'array', fields: [{ name: 'label', type: 'text' }] },
  {
    name: 'layout',
    type: 'blocks',
    blocks: [{ slug: 'hero', fields: [{ name: 'heading', type: 'text' }] }],
  },
  { name: 'tags', type: 'text', hasMany: true },
  { name: 'category', type: 'relationship', relationTo: 'categories', hasMany: false },
  { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true },
  { name: 'disabled', type: 'text', admin: { disabled: { groupBy: true } } },
  { name: 'meta', type: 'group', fields: [{ name: 'status', type: 'text' }] },
  {
    type: 'tabs',
    tabs: [
      { name: 'seo', label: 'SEO', fields: [{ name: 'title', type: 'text' }] },
      { label: 'Other', fields: [{ type: 'row', fields: [{ name: 'count', type: 'number' }] }] },
    ],
  },
]

describe('scalar list grouping (#19134)', () => {
  it('should offer scalar group/tab descendants and exclude every multi-valued path', () => {
    expect([...getGroupByFieldPaths({ fields })]).toEqual([
      'title',
      'category',
      'meta.status',
      'seo.title',
      'count',
    ])
  })

  it.each([
    'links.label',
    '-links.label',
    'layout.hero.heading',
    'tags',
    'categories',
    'unknown',
    ['title'],
    null,
  ])('should recover from unsupported URL, preset or saved-preference grouping: %s', (groupBy) => {
    expect(resolveGroupBy({ fields, groupBy })).toBe('')
  })

  it.each(['title', '-meta.status', 'seo.title'])(
    'should preserve supported grouping %s',
    (groupBy) => {
      expect(resolveGroupBy({ fields, groupBy })).toBe(groupBy)
    },
  )
})
