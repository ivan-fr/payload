import type { FlattenedField } from 'payload'

import { DatabaseSync } from 'node:sqlite'
import { integer, sqliteTable, text, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { operatorMap } from './operatorMap.js'
import { parseParams } from './parseParams.js'

const compile = ({
  operator = 'in',
  limitedBoundParameters = true,
  ids,
}: {
  operator?: 'in' | 'not_in'
  limitedBoundParameters?: boolean
  ids: (number | string | null)[]
}) => {
  const table = sqliteTable('_posts_v', {
    id: integer('id'),
    parent: integer('parent_id'),
    status: text('status'),
  })
  const adapter = {
    name: 'sqlite',
    idType: 'serial',
    limitedBoundParameters,
    operators: operatorMap,
    payload: { config: {}, collections: { posts: { customIDType: undefined } } },
    tables: { _posts_v: table },
  } as unknown as DrizzleAdapter
  return new SQLiteSyncDialect().sqlToQuery(
    parseParams({
      adapter,
      context: { sort: undefined },
      fields: [
        { name: 'parent', type: 'relationship', relationTo: 'posts' },
        { name: 'status', type: 'text' },
      ] as FlattenedField[],
      joins: [],
      parentIsLocalized: false,
      selectFields: {},
      tableName: '_posts_v',
      where: { parent: { [operator]: ids }, status: { equals: 'published' } },
    }),
  )
}

describe('D1 version parent parameter budget (#17493)', () => {
  it.each(['in', 'not_in'] as const)(
    'should compile 120 parent IDs without binding each ID (%s)',
    (operator) => {
      const ids = Array.from({ length: 120 }, (_, i) => i + 1)
      const query = compile({ ids, operator })
      expect(query.params).toEqual(['published'])
      const db = new DatabaseSync(':memory:')
      try {
        db.exec(
          "CREATE TABLE _posts_v (id integer, parent_id integer, status text); INSERT INTO _posts_v VALUES (1, 1, 'published'), (2, 121, 'published'), (3, 2, 'draft')",
        )
        const rows = db
          .prepare(`SELECT id FROM _posts_v WHERE ${query.sql}`)
          .all(...(query.params as string[]))
        expect(rows.map(({ id }) => id)).toEqual(operator === 'in' ? [1] : [2])
      } finally {
        db.close()
      }
    },
  )
  it('should keep normal adapters parameterized', () => {
    expect(compile({ ids: [1, 2], limitedBoundParameters: false }).params).toEqual([
      1,
      2,
      'published',
    ])
  })
  it.each([[], [1, null], [null], [1, 2]])(
    'should preserve ordinary adapter semantics for nullable/empty lists: %j',
    (ids) => {
      const db = new DatabaseSync(':memory:')
      try {
        db.exec(
          "CREATE TABLE _posts_v (id integer, parent_id integer, status text); INSERT INTO _posts_v VALUES (1, 1, 'published'), (2, 3, 'published'), (3, NULL, 'published')",
        )
        for (const operator of ['in', 'not_in'] as const) {
          const read = (limitedBoundParameters: boolean) => {
            const query = compile({ ids, operator, limitedBoundParameters })
            return db
              .prepare(`SELECT id FROM _posts_v WHERE ${query.sql}`)
              .all(...(query.params as (number | string | null)[]))
          }
          expect(read(true)).toEqual(read(false))
        }
      } finally {
        db.close()
      }
    },
  )
})
