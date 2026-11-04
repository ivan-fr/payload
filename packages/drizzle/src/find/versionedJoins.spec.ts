import type { FlattenedField, SanitizedCollectionConfig } from 'payload'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { boolean, integer, pgTable, PgDialect, timestamp } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { buildFindManyArgs } from './buildFindManyArgs.js'

const products = pgTable('products', { id: integer().primaryKey() })
const versions = pgTable('_variants_v', {
  id: integer().primaryKey(),
  parent: integer('parent_id'),
  version_product: integer('version_product_id'),
  latest: boolean(),
  createdAt: timestamp('created_at'),
  version_createdAt: timestamp('version_created_at'),
})
const relation = { name: 'product', type: 'relationship', relationTo: 'products' }
const variants = {
  slug: 'variants',
  fields: [relation],
  flattenedFields: [relation],
  versions: { drafts: true },
  timestamps: true,
} as SanitizedCollectionConfig

describe('versioned join projection', () => {
  it('should project a filtered version parent ID only once in PostgreSQL', () => {
    const adapter = {
      name: 'postgres',
      idType: 'serial',
      drizzle: drizzle.mock(),
      tables: { products, _variants_v: versions },
      tableNameMap: new Map([
        ['products', 'products'],
        ['_variants_v', '_variants_v'],
      ]),
      versionsSuffix: '_v',
      payload: {
        config: { localization: false },
        collections: { variants: { config: variants } },
      },
      operators: { equals: eq },
      operatorHandlers: [],
    } as unknown as DrizzleAdapter
    const args = buildFindManyArgs({
      adapter,
      fields: [
        {
          name: 'variants',
          type: 'join',
          collection: 'variants',
          on: 'product',
          targetField: relation,
        },
      ] as FlattenedField[],
      depth: 0,
      draftsEnabled: true,
      tableName: 'products',
      joinQuery: { variants: { where: { id: { equals: 12 } }, count: true } },
    })
    const dialect = new PgDialect()
    for (const projection of Object.values(args.extras!)) {
      const statement = dialect.sqlToQuery((projection as { sql: never }).sql).sql
      const innerProjection = statement.match(/from \(select ([\s\S]*?) from /i)?.[1]
      expect(innerProjection).toBeDefined()
      expect(innerProjection!.match(/"parent_id"/g)).toHaveLength(1)
    }
  })
})
