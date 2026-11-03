import type { PgTableWithColumns } from 'drizzle-orm/pg-core'

import { count, sql } from 'drizzle-orm'

import type { BasePostgresAdapter, CountDistinct } from './types.js'

export const countDistinct: CountDistinct = async function countDistinct(
  this: BasePostgresAdapter,
  { column, db, joins, tableName, where },
) {
  // Unknown cardinality stays on the grouped path. Only proven to-one joins are safe here.
  if (
    joins.length === 0 ||
    (!column &&
      joins.every(({ type, isOneToMany }) => isOneToMany === false && type !== 'rightJoin'))
  ) {
    let query = db
      .select({
        count: column ? count(sql`DISTINCT ${column}`) : count(),
      })
      .from(this.tables[tableName])
      .where(where)
      .$dynamic()

    for (const { type, condition, table } of joins) {
      query = query[type ?? 'leftJoin'](table as PgTableWithColumns<any>, condition)
    }

    const countResult = await query
    return Number(countResult?.[0]?.count ?? 0)
  }

  let query = db
    .select({
      count: sql`COUNT(1) OVER()`,
    })
    .from(this.tables[tableName])
    .where(where)
    .groupBy(column || this.tables[tableName].id)
    .limit(1)
    .$dynamic()

  joins.forEach(({ type, condition, table }) => {
    query = query[type ?? 'leftJoin'](table as PgTableWithColumns<any>, condition)
  })

  // Potentially multiplying joins require counting each individual ID only once.
  // COUNT(*) doesn't work for this well in this case, as it also counts joined tables.
  // SELECT (COUNT DISTINCT id) has a very slow performance on large tables.
  // Instead, COUNT (GROUP BY id) can be used which is still slower than COUNT(*) but acceptable.
  const countResult = await query

  return Number(countResult?.[0]?.count ?? 0)
}
