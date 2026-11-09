import type { Column, SQL } from 'drizzle-orm'

import { sql } from 'drizzle-orm'
import { APIError } from 'payload'

import { isValidStringID } from '../utilities/isValidStringID.js'

/** Inline validated identifiers for adapters with a small bound-parameter budget. */
export const buildLimitedIDList = ({
  column,
  operator,
  values,
}: {
  column: Column | SQL
  operator: 'in' | 'not_in'
  values: unknown[]
}): SQL => {
  const items = values.map((value) => {
    if (value === null) {
      return sql`NULL`
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return sql.raw(String(value))
    }
    if (typeof value === 'string' && isValidStringID(value)) {
      return sql.raw(`'${value}'`)
    }
    throw new APIError('Invalid ID value in identifier list')
  })
  if (!items.length) {
    return operator === 'in' ? sql`false` : sql`true`
  }
  const sqlOperator = sql.raw(operator === 'in' ? 'IN' : 'NOT IN')
  const idList = sql.join(items, sql`, `)
  return sql`${column} ${sqlOperator} (${idList})`
}
