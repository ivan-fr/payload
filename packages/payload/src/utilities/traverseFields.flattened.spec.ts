import type { Field } from '../fields/config/types.js'

import { describe, expect, it } from 'vitest'

import { traverseFields } from './traverseFields.js'

const fields: Field[] = [
  { name: 'legal', type: 'group', localized: true, fields: [{ name: 'notice', type: 'text' }] },
  {
    type: 'tabs',
    tabs: [{ name: 'details', localized: true, fields: [{ name: 'note', type: 'text' }] }],
  },
  {
    name: 'rows',
    type: 'array',
    localized: true,
    fields: [{ name: 'nested', type: 'group', fields: [{ name: 'label', type: 'text' }] }],
  },
]

describe('traversing locale-resolved documents (#18217)', () => {
  it('should traverse flattened localized containers and preserve their references', () => {
    const ref = {
      legal: { notice: 'Legal' },
      details: { note: 'Detail' },
      rows: [{ nested: { label: 'Nested' } }],
    }
    const seen: Record<string, unknown> = {}

    traverseFields({
      fields,
      fillEmpty: false,
      flattenLocales: true,
      ref,
      callback: ({ field, parentPath, parentIsLocalized, ref: current }) => {
        if (field.type === 'text') {
          seen[parentPath + field.name] = (current as Record<string, unknown>)[field.name]
          expect(parentIsLocalized).toBe(true)
        }
      },
    })
    expect(seen).toEqual({
      'legal.notice': 'Legal',
      'details.note': 'Detail',
      'rows.nested.label': 'Nested',
    })
    expect(ref.legal.notice).toBe('Legal')
  })

  it('should traverse a flattened child named like a locale without guessing its shape', () => {
    const seen: unknown[] = []

    traverseFields({
      fields: [
        { name: 'group', type: 'group', localized: true, fields: [{ name: 'en', type: 'text' }] },
      ],
      fillEmpty: false,
      flattenLocales: true,
      ref: { group: { en: 'Resolved' } },
      callback: ({ field, ref }) => {
        if (field.type === 'text') seen.push((ref as Record<string, unknown>).en)
      },
    })
    expect(seen).toEqual(['Resolved'])
  })

  it('should thread flattened mode through array rows and reusable block fields', () => {
    const nested: Field = {
      name: 'nested',
      type: 'group',
      localized: true,
      fields: [{ name: 'value', type: 'text' }],
    }
    const seen: Record<string, unknown> = {}

    traverseFields({
      config: { blocks: [{ slug: 'shared', fields: [nested] }] },
      fields: [
        { name: 'rows', type: 'array', fields: [nested] },
        { name: 'content', type: 'blocks', blocks: ['shared'] },
      ],
      fillEmpty: false,
      flattenLocales: true,
      ref: {
        rows: [{ nested: { value: 'Array' } }],
        content: [{ blockType: 'shared', nested: { value: 'Block' } }],
      },
      callback: ({ field, parentPath, ref }) => {
        if (field.type === 'text')
          seen[parentPath + field.name] = (ref as Record<string, unknown>)[field.name]
      },
    })
    expect(seen).toEqual({ 'rows.nested.value': 'Array', 'content.nested.value': 'Block' })
  })

  it('should preserve default all-locale traversal including children named like locale codes', () => {
    const seen: unknown[] = []

    traverseFields({
      fields: [
        { name: 'group', type: 'group', localized: true, fields: [{ name: 'en', type: 'text' }] },
      ],
      fillEmpty: false,
      ref: { group: { en: { en: 'English' }, fr: { en: 'French' } } },
      callback: ({ field, ref }) => {
        if (field.type === 'text') seen.push((ref as Record<string, unknown>).en)
      },
    })
    expect(seen).toEqual(['English', 'French'])
  })

  it('should fill missing flattened containers without synthesizing locale maps', () => {
    const ref: Record<string, unknown> = {}

    traverseFields({ fields, flattenLocales: true, ref, callback: () => {} })
    expect(ref).toEqual({ legal: {}, details: {}, rows: [] })
  })
})
