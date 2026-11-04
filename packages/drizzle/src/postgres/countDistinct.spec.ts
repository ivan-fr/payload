import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'

import type { BasePostgresAdapter } from './types.js'

import { buildQuery } from '../queries/buildQuery.js'
import { countDistinct } from './countDistinct.js'

const orders = pgTable('orders', { id: integer().primaryKey(), customer: integer() })
const customers = pgTable('customers', { id: integer().primaryKey(), name: text() })

describe('cardinality-aware PostgreSQL counts (#19139)', () => {
  it.each([false, true, undefined])(
    'should group only potentially multiplying joins (%s)',
    async (isOneToMany) => {
      const query = vi.fn(async () => ({ rows: [['3']] }))
      const db = drizzle({ client: { query } as never })
      const adapter = { tables: { orders } } as unknown as BasePostgresAdapter
      const result = await countDistinct.call(adapter, {
        db,
        joins: [{ table: customers, condition: eq(orders.customer, customers.id), isOneToMany }],
        tableName: 'orders',
        where: sql`true`,
      })
      expect(result).toBe(3)
      const statement = query.mock.calls[0]![0] as { text: string }
      expect(statement.text).toContain('left join')
      expect(statement.text.includes('group by')).toBe(isOneToMany !== false)
    },
  )

  it('should preserve grouped explicit-column counts with joins', async () => {
    const query = vi.fn(async () => ({ rows: [['2']] }))
    const db = drizzle({ client: { query } as never })
    const adapter = { tables: { orders } } as unknown as BasePostgresAdapter
    expect(
      await countDistinct.call(adapter, {
        column: orders.customer,
        db,
        joins: [
          { table: customers, condition: eq(orders.customer, customers.id), isOneToMany: false },
        ],
        tableName: 'orders',
        where: sql`true`,
      }),
    ).toBe(2)
    expect((query.mock.calls[0]![0] as { text: string }).text.toLowerCase()).toContain('group by')
  })

  it('should mark a resolved single relationship join as nonmultiplying', () => {
    const adapter = {
      name: 'postgres',
      idType: 'serial',
      tables: { orders, customers },
      tableNameMap: new Map([
        ['customers', 'customers'],
        ['orders', 'orders'],
      ]),
      payload: {
        config: { localization: false },
        collections: {
          customers: {
            config: { slug: 'customers', flattenedFields: [{ name: 'name', type: 'text' }] },
          },
        },
      },
      operatorHandlers: [],
      operators: { equals: eq },
    } as unknown as BasePostgresAdapter
    const { joins } = buildQuery({
      adapter,
      tableName: 'orders',
      fields: [{ name: 'customer', type: 'relationship', relationTo: 'customers' }] as never,
      where: { 'customer.name': { equals: 'Alice' } },
    })
    expect(joins).toHaveLength(1)
    expect(joins[0]!.isOneToMany).toBe(false)
  })
})
