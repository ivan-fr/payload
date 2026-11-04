import type { Field } from 'payload'

import { inArray, sql } from 'drizzle-orm'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { sanitizeQueryValue } from './sanitizeQueryValue.js'

const value = ({
  ids,
  customIDType,
  idType = 'serial',
}: {
  ids: (number | string)[]
  customIDType?: 'number' | 'text'
  idType?: string
}) =>
  sanitizeQueryValue({
    adapter: {
      idType,
      payload: { collections: { posts: { customIDType } } },
    } as unknown as DrizzleAdapter,
    field: { name: 'parent', type: 'relationship', relationTo: 'posts' } as Field,
    isUUID: idType === 'uuid',
    operator: 'in',
    relationOrPath: 'parent',
    val: ids,
  }).value

describe('typed relationship lists and parameter budgets (#18251)', () => {
  it('should bind each numeric ID once after coercion', () => {
    const ids = Array.from({ length: 50 }, (_, i) => i + 1)
    const result = value({ ids }) as number[]
    const query = new SQLiteSyncDialect().sqlToQuery(inArray(sql`parent`, result))

    expect(result).toEqual(ids)
    expect(query.params).toHaveLength(50)
    expect(value({ ids: [0, '0', 1, '1'] })).toEqual([0, 1])
  })

  it('should preserve custom text IDs without inventing numeric spellings', () => {
    expect(value({ ids: ['001', 'alpha', '001'], customIDType: 'text' })).toEqual(['001', 'alpha'])
  })

  it('should coerce and deduplicate polymorphic columns independently', () => {
    const result = sanitizeQueryValue({
      adapter: { idType: 'serial', payload: { collections: {} } } as unknown as DrizzleAdapter,
      columns: [
        { idType: 'number', rawColumn: sql`numeric_id` },
        { idType: 'text', rawColumn: sql`text_id` },
      ],
      field: { name: 'link', type: 'relationship', relationTo: ['posts', 'pages'] } as Field,
      isUUID: false,
      operator: 'in',
      relationOrPath: 'link',
      val: [1, '1', '002'],
    })

    expect(result.columns!.map((column) => column.value)).toEqual([
      [1, 2],
      ['1', '002'],
    ])
  })

  it('should retain UUID identifiers and remove duplicates', () => {
    const id = '878aeef4-b31c-4512-863d-43912f7cf81c'

    expect(value({ ids: [id, id], idType: 'uuid' })).toEqual([id])
  })
})
