import type { FlattenedField } from 'payload'

import { drizzle } from 'drizzle-orm/node-postgres'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { buildQuery } from './buildQuery.js'
import { operatorMap } from './operatorMap.js'

describe('block query joins (#19459)', () => {
  it.each(['or', 'and'])(
    'should reuse the block table for %s predicates on sibling fields',
    (operator) => {
      const articles = pgTable('articles', { id: integer('id') })
      const card = pgTable('articles_blocks_card', {
        id: text('id'),
        _parentID: integer('_parent_id'),
        _path: text('_path'),
        heading: text('heading'),
        caption: text('caption'),
      })
      const adapter = {
        name: 'postgres',
        idType: 'serial',
        tables: { articles, articles_blocks_card: card },
        tableNameMap: new Map([['articles_blocks_card', 'articles_blocks_card']]),
        payload: { blocks: {}, config: { localization: false } },
        operators: operatorMap,
        operatorHandlers: [],
      } as unknown as DrizzleAdapter
      const fields = [
        {
          name: 'layout',
          type: 'blocks',
          blocks: [
            {
              slug: 'card',
              flattenedFields: [
                { name: 'heading', type: 'text' },
                { name: 'caption', type: 'text' },
              ],
            },
          ],
        },
      ] as FlattenedField[]
      const { joins, where } = buildQuery({
        adapter,
        fields,
        tableName: 'articles',
        where: {
          [operator]: [
            { 'layout.heading': { equals: 'needle' } },
            { 'layout.caption': { equals: 'needle' } },
          ],
        },
      })
      let query = drizzle.mock().select({ id: articles.id }).from(articles).where(where).$dynamic()

      for (const join of joins) {
        query = query.leftJoin(join.table, join.condition)
      }

      expect(joins).toHaveLength(1)
      expect(query.toSQL().sql).toContain('"articles_blocks_card"."heading"')
      expect(query.toSQL().sql).toContain('"articles_blocks_card"."caption"')
    },
  )
})
