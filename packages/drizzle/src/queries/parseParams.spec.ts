import type { FlattenedField } from 'payload'

import { DatabaseSync } from 'node:sqlite'
import { like, notLike } from 'drizzle-orm'
import { PgDialect, pgTable, serial, text as pgText, uuid } from 'drizzle-orm/pg-core'
import { integer, SQLiteSyncDialect, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { operatorMap } from './operatorMap.js'
import { parseParams } from './parseParams.js'

describe('SQL like query parsing', () => {
  const fields = [{ name: 'title', type: 'text' }] as FlattenedField[]

  it.each([
    ['like', 'hello', ['HELLO WORLD', 'hello there']],
    ['not_like', 'hello', ['goodbye', 'world alone']],
    ['like', 'hello world', ['HELLO WORLD']],
    ['not_like', 'hello world', ['goodbye']],
  ] as const)('should evaluate %s with partial words (%s) on SQLite', (operator, value, titles) => {
    const table = sqliteTable('posts', { id: integer('id'), title: text('title') })
    const adapter = {
      name: 'sqlite',
      operators: { ...operatorMap, like, not_like: notLike },
      payload: { config: {} },
      tables: { posts: table },
    } as unknown as DrizzleAdapter
    const constraint = parseParams({
      adapter,
      context: { sort: undefined },
      fields,
      joins: [],
      parentIsLocalized: false,
      selectFields: {},
      tableName: 'posts',
      where: { title: { [operator]: value } },
    })
    const query = new SQLiteSyncDialect().sqlToQuery(constraint)
    const db = new DatabaseSync(':memory:')

    try {
      db.exec(
        "CREATE TABLE posts (id integer, title text); INSERT INTO posts VALUES (1, 'HELLO WORLD'), (2, 'hello there'), (3, 'goodbye'), (4, 'world alone')",
      )
      const rows = db
        .prepare(`SELECT title FROM posts WHERE ${query.sql} ORDER BY id`)
        .all(...(query.params as string[]))

      expect(rows.map((row) => row.title)).toEqual(titles)
    } finally {
      db.close()
    }
  })

  it('should bind each Postgres not_like word as a partial match', () => {
    const table = pgTable('posts', { id: serial('id'), title: pgText('title') })
    const adapter = {
      name: 'postgres',
      operators: operatorMap,
      payload: { config: {} },
      tables: { posts: table },
    } as unknown as DrizzleAdapter
    const constraint = parseParams({
      adapter,
      context: { sort: undefined },
      fields,
      joins: [],
      parentIsLocalized: false,
      selectFields: {},
      tableName: 'posts',
      where: { title: { not_like: 'hello world' } },
    })
    const query = new PgDialect().sqlToQuery(constraint)

    expect(query.params).toEqual(['%hello%', '%world%'])
    expect(query.sql).toContain('not ilike')
    expect(query.sql).toContain(' and ')
  })

  it.each(['number', 'uuid'] as const)(
    'should compare %s ids with not_equals instead of string matching',
    (idType) => {
      const table = pgTable('posts', {
        id: idType === 'number' ? serial('id') : uuid('id'),
      })
      const adapter = {
        idType,
        name: 'postgres',
        operators: operatorMap,
        payload: { config: {} },
        tables: { posts: table },
      } as unknown as DrizzleAdapter
      const value = idType === 'number' ? 3 : '00000000-0000-4000-8000-000000000001'
      const constraint = parseParams({
        adapter,
        context: { sort: undefined },
        fields: [],
        joins: [],
        parentIsLocalized: false,
        selectFields: {},
        tableName: 'posts',
        where: { id: { not_like: value } },
      })
      const query = new PgDialect().sqlToQuery(constraint)

      expect(query.sql).toContain('<>')
      expect(query.sql).not.toContain('like')
      expect(query.params).toEqual([value])
    },
  )
})
