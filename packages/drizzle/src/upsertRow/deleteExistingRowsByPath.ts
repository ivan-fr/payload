import { and, eq, inArray, or, sql } from 'drizzle-orm'

import type { DrizzleAdapter, DrizzleTransaction } from '../types.js'

type Args = {
  adapter: DrizzleAdapter
  db: DrizzleAdapter['drizzle'] | DrizzleTransaction
  localeColumnName?: string
  parentColumnName?: string
  parentID: unknown
  pathColumnName?: string
  rows: Record<string, unknown>[]
  tableName: string
}

export const deleteExistingRowsByPath = async ({
  adapter,
  db,
  localeColumnName = '_locale',
  parentColumnName = '_parentID',
  parentID,
  pathColumnName = '_path',
  rows,
  tableName,
}: Args): Promise<void> => {
  const localizedPathsToDelete = new Set<string>()
  const pathsToDelete = new Set<string>()
  const table = adapter.tables[tableName]

  if (!table) {
    return
  }

  const prefixesToDelete: { locale?: string; prefix: string }[] = []

  rows.forEach((row) => {
    const path = row[pathColumnName]
    const localeData = row[localeColumnName]

    if (row.isPathPrefix === true) {
      if (typeof row.path === 'string' && row.path) {
        prefixesToDelete.push({
          locale: typeof row.locale === 'string' ? row.locale : undefined,
          prefix: row.path,
        })
      }

      return
    }

    if (typeof path === 'string') {
      if (typeof localeData === 'string') {
        localizedPathsToDelete.add(path)
      } else {
        pathsToDelete.add(path)
      }
    }
  })

  // Prefixes are deleted first, so the rows about to be inserted below them start from a clean
  // slate. `substr` is used instead of LIKE because paths can contain LIKE wildcards such as `_`.
  if (pathColumnName && table[pathColumnName] && prefixesToDelete.length > 0) {
    const prefixConstraints = prefixesToDelete.map(({ locale, prefix }) => {
      const isBelowPrefix = sql`substr(${table[pathColumnName]}, 1, ${prefix.length}) = ${prefix}`

      return locale && table[localeColumnName]
        ? and(isBelowPrefix, eq(table[localeColumnName], locale))
        : isBelowPrefix
    })

    await adapter.deleteWhere({
      db,
      tableName,
      where: and(eq(table[parentColumnName], parentID), or(...prefixConstraints)),
    })
  }

  if (localizedPathsToDelete.size > 0) {
    const whereConstraints = [eq(table[parentColumnName], parentID)]

    if (pathColumnName) {
      whereConstraints.push(inArray(table[pathColumnName], Array.from(localizedPathsToDelete)))
    }

    await adapter.deleteWhere({
      db,
      tableName,
      where: and(...whereConstraints),
    })
  }

  if (pathsToDelete.size > 0) {
    const whereConstraints = [eq(table[parentColumnName], parentID)]

    if (pathColumnName) {
      whereConstraints.push(inArray(table[pathColumnName], Array.from(pathsToDelete)))
    }

    await adapter.deleteWhere({
      db,
      tableName,
      where: and(...whereConstraints),
    })
  }
}
