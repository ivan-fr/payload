import type { FlattenedField } from 'payload'

import { drizzle } from 'drizzle-orm/node-postgres'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { buildQuery } from './buildQuery.js'
import { operatorMap } from './operatorMap.js'

describe('nested block query storage (#18312, #18273)', () => {
  it.each(['lineup.performers.name', 'lineup.performers.guest.name'])(
    'should resolve %s against the root block table',
    (path) => {
      const events = pgTable('events', { id: integer('id') })
      const lineup = pgTable('events_lineup', { id: text('id'), _parentID: integer('_parent_id') })
      const guest = pgTable('events_blocks_guest', {
        id: text('id'),
        _parentID: integer('_parent_id'),
        _path: text('_path'),
        name: text('name'),
      })
      const adapter = {
        name: 'postgres',
        idType: 'serial',
        tables: { events, events_lineup: lineup, events_blocks_guest: guest },
        tableNameMap: new Map([
          ['events_lineup', 'events_lineup'],
          ['events_blocks_guest', 'events_blocks_guest'],
        ]),
        payload: { blocks: {}, config: { localization: false } },
        operators: operatorMap,
        operatorHandlers: [],
      } as unknown as DrizzleAdapter
      const fields = [
        {
          name: 'lineup',
          type: 'array',
          flattenedFields: [
            {
              name: 'performers',
              type: 'blocks',
              blocks: [{ slug: 'guest', flattenedFields: [{ name: 'name', type: 'text' }] }],
            },
          ],
        },
      ] as FlattenedField[]
      const result = buildQuery({
        adapter,
        fields,
        tableName: 'events',
        where: { [path]: { equals: 'Guest' } },
      })
      let query = drizzle
        .mock()
        .select({ id: events.id })
        .from(events)
        .where(result.where)
        .$dynamic()

      for (const join of result.joins) {
        query = query.leftJoin(join.table, join.condition)
      }

      expect(query.toSQL().sql).toContain('"events"."id" = "events_blocks_guest"."_parent_id"')
      expect(query.toSQL().params).toContain('lineup.%.performers')
      expect(Object.values(result.selectFields).every(Boolean)).toBe(true)
    },
  )
})

describe('empty UUID polymorphic predicates (#16195)', () => {
  it.each(['in', 'equals'] as const)('should compile %s [] as false', (operator) => {
    const pages = pgTable('pages', { id: uuid('id') })
    const rels = pgTable('pages_rels', {
      id: integer('id'),
      parent: uuid('parent_id'),
      path: text('path'),
      groupsID: uuid('groups_id'),
      usersID: uuid('users_id'),
    })
    const adapter = {
      name: 'postgres',
      idType: 'uuid',
      relationshipsSuffix: '_rels',
      tables: { pages, pages_rels: rels },
      tableNameMap: new Map([
        ['groups', 'groups'],
        ['users', 'users'],
      ]),
      payload: {
        config: { localization: false },
        collections: {
          groups: { config: { slug: 'groups' } },
          users: { config: { slug: 'users' } },
        },
      },
      operators: operatorMap,
      operatorHandlers: [],
    } as unknown as DrizzleAdapter
    const result = buildQuery({
      adapter,
      fields: [
        { name: 'entity', type: 'relationship', relationTo: ['groups', 'users'] },
      ] as FlattenedField[],
      tableName: 'pages',
      where: { 'entity.value': { [operator]: [] } },
    })
    const query = drizzle.mock().select().from(pages).where(result.where).toSQL()

    expect(query.sql).toContain('false')
  })
})
