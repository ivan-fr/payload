import type { DrizzleAdapter } from '../types.js'

import { eq } from 'drizzle-orm'
import { pgTable, PgDialect, uuid } from 'drizzle-orm/pg-core'
import { buildQuery } from './buildQuery.js'
import { describe, expect, it } from 'vitest'

import { sanitizeQueryValue } from './sanitizeQueryValue.js'

const adapter = {} as DrizzleAdapter
const valid = '550e8400-e29b-41d4-a716-446655440000'
const sanitize = ({ operator = 'equals', val }: { operator?: string; val: unknown }) =>
  sanitizeQueryValue({
    adapter,
    field: { name: 'id', type: 'text' },
    isUUID: true,
    operator,
    relationOrPath: 'id',
    val,
  })

describe('UUID query validation (#16483)', () => {
  it.each(['equals', 'not_equals', 'in', 'not_in'])(
    'should reject invalid UUID strings for %s instead of converting them to null',
    (operator) => {
      expect(() =>
        sanitize({ operator, val: operator.includes('in') ? [valid, 'invalid-id'] : 'invalid-id' }),
      ).toThrowError(expect.objectContaining({ status: 400 }))
    },
  )
  it('should preserve valid UUIDs, explicit null and existence operators', () => {
    expect(sanitize({ val: valid }).value).toBe(valid)
    expect(sanitize({ val: null }).value).toBeNull()
    expect(sanitize({ val: 'null' }).value).toBeNull()
    expect(sanitize({ operator: 'in', val: [valid] }).value).toEqual([valid])
    expect(sanitize({ operator: 'exists', val: true }).value).toBe(true)
  })
})

describe('PostgreSQL UUID query construction', () => {
  it('should distinguish an invalid UUID predicate from an explicit IS NULL query', () => {
    const table = pgTable('posts', { id: uuid().primaryKey() })
    const adapter = {
      name: 'postgres',
      tables: { posts: table },
      tableNameMap: new Map(),
      payload: { config: { localization: false } },
      operators: { equals: eq },
      operatorHandlers: [],
    } as unknown as DrizzleAdapter
    const fields = [{ name: 'id', type: 'text' }] as never
    const query = ({ value }: { value: unknown }) =>
      buildQuery({ adapter, fields, tableName: 'posts', where: { id: { equals: value } } as never })
    expect(() => query({ value: 'invalid-id' })).toThrowError(
      expect.objectContaining({ status: 400 }),
    )
    const dialect = new PgDialect()
    expect(dialect.sqlToQuery(query({ value: valid }).where).params).toEqual([valid])
    expect(dialect.sqlToQuery(query({ value: null }).where).sql).toContain('is null')
  })
  it.each(['like', 'not_like'])(
    'should keep impossible UUID %s searches safe without converting them to NULL equality',
    (operator) => {
      const table = pgTable('posts', { id: uuid().primaryKey() })
      const adapter = {
        name: 'postgres',
        tables: { posts: table },
        tableNameMap: new Map(),
        payload: { config: { localization: false } },
        operators: { equals: eq },
        operatorHandlers: [],
      } as unknown as DrizzleAdapter
      const { where } = buildQuery({
        adapter,
        fields: [{ name: 'id', type: 'text' }],
        tableName: 'posts',
        where: { id: { [operator]: 'words partial' } },
      })
      const query = new PgDialect().sqlToQuery(where)
      expect(query.params).toEqual([])
      expect(query.sql).toBe(operator === 'like' ? 'false' : '"posts"."id" is not null')
    },
  )
})
