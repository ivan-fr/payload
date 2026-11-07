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
  { name: 'related', type: 'relationship', relationTo: ['categories', 'posts'], hasMany: true },
  { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
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

describe('list grouping (#19134)', () => {
  it('should offer scalar descendants and relationship groups while excluding array descendants', () => {
    expect([...getGroupByFieldPaths({ fields })]).toEqual([
      'title',
      'category',
      'categories',
      'related',
      'images',
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
    'unknown',
    ['title'],
    null,
  ])('should recover from unsupported URL, preset or saved-preference grouping: %s', (groupBy) => {
    expect(resolveGroupBy({ fields, groupBy })).toBe('')
  })

  it.each(['title', '-meta.status', 'seo.title', 'categories', '-related', 'images'])(
    'should preserve supported grouping %s',
    (groupBy) => {
      expect(resolveGroupBy({ fields, groupBy })).toBe(groupBy)
    },
  )
})

it('should accept relationship-backed scalar query paths and reject computed virtual grouping', () => {
  const fields: Field[] = [
    { name: 'label', type: 'text', virtual: 'related.title' },
    { name: 'computed', type: 'text', virtual: true },
  ]
  expect([...getGroupByFieldPaths({ fields })]).toEqual(['related.title'])
  expect(resolveGroupBy({ fields, groupBy: 'related.title' })).toBe('related.title')
  expect(resolveGroupBy({ fields, groupBy: 'computed' })).toBe('')
})

it('should resolve virtual group descendants relative to the backing relationship', () => {
  const fields: Field[] = [
    {
      name: 'alias',
      type: 'group',
      virtual: 'related.info',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'tags', type: 'text', hasMany: true },
      ],
    },
    {
      name: 'meta',
      type: 'group',
      fields: [{ name: 'alias', type: 'text', virtual: 'related.name' }],
    },
  ]
  expect([...getGroupByFieldPaths({ fields })]).toEqual(['related.info.title', 'meta.related.name'])
  expect(resolveGroupBy({ fields, groupBy: '-related.info.title' })).toBe('-related.info.title')
})
