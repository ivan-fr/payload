import type { FlattenedField, PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { unflattenObject } from './unflattenObject.js'

const req = { payload: { logger: { error: vi.fn() } } } as unknown as PayloadRequest
const fields = [
  { name: 'vat_number', type: 'text' },
  { name: '_leading_name_1', type: 'text' },
  { name: 'local_name_1', type: 'text', localized: true },
  { name: 'group_name', type: 'group', flattenedFields: [{ name: 'vat_number', type: 'text' }] },
  { name: 'array_items', type: 'array', flattenedFields: [{ name: 'item_name', type: 'text' }] },
] as FlattenedField[]

describe('schema-aware CSV names (#17118)', () => {
  it('should retain complete field names at root and nested levels', () => {
    expect(
      unflattenObject({
        fields,
        req,
        data: {
          vat_number: 'FR123',
          _leading_name_1: 'kept',
          local_name_1_en: 'English',
          local_name_1_es: 'Spanish',
          group_name_vat_number: 'FR456',
          array_items_0_item_name: 'first',
          array_items_1_item_name: 'second',
        },
      }),
    ).toEqual({
      vat_number: 'FR123',
      _leading_name_1: 'kept',
      local_name_1: { en: 'English', es: 'Spanish' },
      group_name: { vat_number: 'FR456' },
      array_items: [{ item_name: 'first' }, { item_name: 'second' }],
    })
  })
  it('should invoke static array hooks for underscored field names', () => {
    const hook = vi.fn(({ value }) => String(value).toUpperCase())
    const doc = unflattenObject({
      fields,
      req,
      data: { array_items_0_item_name: 'first' },
      importFieldHooks: { array_items_item_name: { fn: hook } as never },
    })
    expect(doc.array_items).toEqual([{ item_name: 'FIRST' }])
    expect(hook).toHaveBeenCalledOnce()
  })

  it('should resolve block slugs and child names containing underscores', () => {
    const blockFields = [
      {
        name: 'content_blocks',
        type: 'blocks',
        blocks: [{ slug: 'hero_block', flattenedFields: [{ name: 'heading_text', type: 'text' }] }],
      },
    ] as FlattenedField[]
    expect(
      unflattenObject({
        fields: blockFields,
        req,
        data: { content_blocks_0_hero_block_heading_text: 'Heading' },
      }),
    ).toEqual({ content_blocks: [{ blockType: 'hero_block', heading_text: 'Heading' }] })
  })

  it('should prefer an exact schema name over an ambiguous legacy nested path', () => {
    const colliding = [
      { name: 'vat', type: 'group', flattenedFields: [{ name: 'number', type: 'text' }] },
      { name: 'vat_number', type: 'text' },
    ] as FlattenedField[]
    expect(unflattenObject({ fields: colliding, req, data: { vat_number: 'FR123' } })).toEqual({
      vat_number: 'FR123',
    })
  })
})
