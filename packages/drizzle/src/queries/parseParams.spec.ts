import type { FlattenedField } from 'payload'

import { DatabaseSync } from 'node:sqlite'
import { like, notLike } from 'drizzle-orm'
import {
  PgDialect,
  pgTable,
  serial,
  integer as pgInteger,
  text as pgText,
  uuid,
} from 'drizzle-orm/pg-core'
import { integer, SQLiteSyncDialect, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { operatorMap, withLikeEscape } from './operatorMap.js'
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
      operators: {
        ...operatorMap,
        like: withLikeEscape({ operator: like }),
        not_like: withLikeEscape({ operator: notLike }),
      },
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

describe('literal SQL search characters (#18325)', () => {
  it.each(['like', 'not_like', 'contains'] as const)(
    'should treat wildcard characters literally for %s',
    (operator) => {
      const table = sqliteTable('posts', { id: integer('id'), title: text('title') })
      const adapter = {
        name: 'sqlite',
        operators: {
          ...operatorMap,
          contains: withLikeEscape({ operator: like }),
          like: withLikeEscape({ operator: like }),
          not_like: withLikeEscape({ operator: notLike }),
        },
        payload: { config: {} },
        tables: { posts: table },
      } as unknown as DrizzleAdapter
      const db = new DatabaseSync(':memory:')
      const titles = ['50% off', '500 off', 'a_b', 'axb', 'a\\b', 'ab']

      try {
        db.exec('CREATE TABLE posts (id integer, title text)')
        titles.forEach((title, index) =>
          db.prepare('INSERT INTO posts VALUES (?, ?)').run(index, title),
        )
        for (const [value, expected] of [
          ['50%', '50% off'],
          ['a_b', 'a_b'],
          ['a\\b', 'a\\b'],
        ]) {
          const constraint = parseParams({
            adapter,
            context: { sort: undefined },
            fields: [{ name: 'title', type: 'text' }],
            joins: [],
            parentIsLocalized: false,
            selectFields: {},
            tableName: 'posts',
            where: { title: { [operator]: value } },
          })
          const query = new SQLiteSyncDialect().sqlToQuery(constraint)
          const rows = db
            .prepare(`SELECT title FROM posts WHERE ${query.sql}`)
            .all(...(query.params as string[]))

          expect(rows.map((row) => row.title).sort()).toEqual(
            (operator === 'not_like'
              ? titles.filter((title) => title !== expected)
              : [expected]
            ).sort(),
          )
        }
      } finally {
        db.close()
      }
    },
  )
})

describe('Postgres literal search SQL (#18325)', () => {
  it.each(['like', 'not_like', 'contains'] as const)(
    'should bind escaped %s patterns and declare the escape character',
    (operator) => {
      const table = pgTable('posts', { title: pgText('title') })
      const adapter = {
        name: 'postgres',
        operators: operatorMap,
        payload: { config: {} },
        tables: { posts: table },
      } as unknown as DrizzleAdapter
      const constraint = parseParams({
        adapter,
        context: { sort: undefined },
        fields: [{ name: 'title', type: 'text' }],
        joins: [],
        parentIsLocalized: false,
        selectFields: {},
        tableName: 'posts',
        where: { title: { [operator]: '50%_a\\b' } },
      })
      const query = new PgDialect().sqlToQuery(constraint)

      expect(query.params).toEqual(['%50\\%\\_a\\\\b%'])
      expect(query.sql).toContain(`ESCAPE '\\'`)
      expect(query.sql).not.toContain('50%')
    },
  )
})

describe('draft parent ID and title searches (#15648)', () => {
  it.each(['serial', 'uuid'] as const)(
    'should compile a valid Postgres %s parent ID and title query',
    (idType) => {
      const table = pgTable('_posts_v', {
        id: serial('id'),
        parent: idType === 'serial' ? pgInteger('parent_id') : uuid('parent_id'),
        version_title: pgText('version_title'),
      })
      const adapter = {
        idType,
        name: 'postgres',
        operators: operatorMap,
        payload: { config: {}, collections: { posts: { config: { slug: 'posts' } } } },
        tables: { _posts_v: table },
        tableNameMap: new Map(),
      } as unknown as DrizzleAdapter
      const parentID = idType === 'serial' ? 'Needle' : '00000000-0000-4000-8000-000000000001'
      const constraint = parseParams({
        adapter,
        context: { sort: undefined },
        fields: [
          { name: 'parent', type: 'relationship', relationTo: 'posts' },
          { name: 'version_title', type: 'text' },
        ] as FlattenedField[],
        joins: [],
        parentIsLocalized: false,
        selectFields: {},
        tableName: '_posts_v',
        where: { or: [{ parent: { equals: parentID } }, { version_title: { like: 'Needle' } }] },
      })
      const query = new PgDialect().sqlToQuery(constraint)
      expect(query.params.some((value) => typeof value === 'number' && Number.isNaN(value))).toBe(
        false,
      )
      expect(query.params).toContain('%Needle%')
      expect(query.sql).toContain(' or ')
    },
  )
})

describe('ID lists with limited bound parameters (#17493)', () => {
  const versionFields = [
    { name: 'parent', type: 'relationship', relationTo: 'posts' },
    { name: 'latest', type: 'checkbox' },
  ] as FlattenedField[]
  const versionsTable = sqliteTable('_posts_v', {
    id: integer('id'),
    latest: integer('latest'),
    parent: integer('parent_id'),
  })
  const postsTable = sqliteTable('posts', { id: integer('id'), parent: text('parent') })

  const buildQuery = ({
    fields,
    limitedBoundParameters = true,
    tableName,
    where,
  }: {
    fields: FlattenedField[]
    limitedBoundParameters?: boolean
    tableName: string
    where: Parameters<typeof parseParams>[0]['where']
  }) => {
    const adapter = {
      name: 'sqlite',
      idType: 'serial',
      limitedBoundParameters,
      operators: operatorMap,
      payload: {
        collections: { posts: { config: { flattenedFields: [] }, customIDType: undefined } },
        config: {},
        db: { defaultIDType: 'number' },
      },
      tables: { _posts_v: versionsTable, posts: postsTable },
    } as unknown as DrizzleAdapter

    return new SQLiteSyncDialect().sqlToQuery(
      parseParams({
        adapter,
        context: { sort: undefined },
        fields,
        joins: [],
        parentIsLocalized: false,
        selectFields: {},
        tableName,
        where,
      }),
    )
  }

  const parentIDs = Array.from({ length: 150 }, (_, index) => index + 1)

  it.each(['in', 'not_in'] as const)(
    'should inline a %s list of version parents instead of binding one parameter per ID',
    (operator) => {
      const query = buildQuery({
        fields: versionFields,
        tableName: '_posts_v',
        where: { and: [{ parent: { [operator]: parentIDs } }, { latest: { equals: true } }] },
      })

      expect(query.params.length).toBeLessThan(5)
      expect(query.sql).toContain(
        `"_posts_v"."parent_id" ${operator === 'in' ? 'IN' : 'NOT IN'} (1,2,3,`,
      )

      const db = new DatabaseSync(':memory:')

      try {
        db.exec(
          'CREATE TABLE _posts_v (id integer, latest integer, parent_id integer); INSERT INTO _posts_v VALUES (1, 1, 7), (2, 1, 900), (3, 0, 8)',
        )
        const rows = db
          .prepare(`SELECT id FROM _posts_v WHERE ${query.sql} ORDER BY id`)
          .all(
            ...query.params.map(
              (param) => (typeof param === 'boolean' ? Number(param) : param) as number,
            ),
          )

        expect(rows.map((row) => row.id)).toEqual(operator === 'in' ? [1] : [2])
      } finally {
        db.close()
      }
    },
  )

  it('should keep binding version parents when the adapter has no parameter limit', () => {
    const query = buildQuery({
      fields: versionFields,
      limitedBoundParameters: false,
      tableName: '_posts_v',
      where: { parent: { in: parentIDs } },
    })

    expect(query.params).toHaveLength(parentIDs.length)
  })

  it('should keep binding values of a text field that happens to be called parent', () => {
    const query = buildQuery({
      fields: [{ name: 'parent', type: 'text' }] as FlattenedField[],
      tableName: 'posts',
      where: { parent: { in: ["it's a text value", 'another one'] } },
    })

    expect(query.params).toEqual(["it's a text value", 'another one'])
  })
})
