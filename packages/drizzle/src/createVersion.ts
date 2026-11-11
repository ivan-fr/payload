import type { CreateVersionArgs, JsonObject, TypeWithVersion } from 'payload'

import { and, eq, gt, or, sql } from 'drizzle-orm'
import { buildVersionCollectionFields } from 'payload'
import { hasDraftsEnabled } from 'payload/shared'
import toSnakeCase from 'to-snake-case'

import type { DrizzleAdapter } from './types.js'

import { upsertRow } from './upsertRow/index.js'
import { getPrimaryDb } from './utilities/getPrimaryDb.js'
import { getTransaction } from './utilities/getTransaction.js'

export async function createVersion<T extends JsonObject = JsonObject>(
  this: DrizzleAdapter,
  {
    autosave,
    collectionSlug,
    createdAt,
    parent,
    publishedLocale,
    req,
    returning,
    select,
    snapshot,
    updatedAt,
    versionData,
  }: CreateVersionArgs<T>,
): Promise<TypeWithVersion<T>> {
  const collection = this.payload.collections[collectionSlug].config
  if (collection.versions.drafts) {
    if (typeof select === 'object') {
      select.updatedAt = true
    }
  }

  const defaultTableName = toSnakeCase(collection.slug)
  const tableName = this.tableNameMap.get(`_${defaultTableName}${this.versionsSuffix}`)

  const version = { ...versionData }
  if (version.id) {
    delete version.id
  }

  const data: Record<string, unknown> = {
    autosave,
    createdAt,
    latest: true,
    parent,
    publishedLocale,
    snapshot,
    updatedAt,
    version,
  }

  const db = getPrimaryDb(this, await getTransaction(this, req))

  const result = await upsertRow<TypeWithVersion<T>>({
    adapter: this,
    collectionSlug,
    data,
    db,
    fields: buildVersionCollectionFields(this.payload.config, collection, true),
    ignoreResult: returning === false ? 'idOnly' : undefined,
    operation: 'create',
    req,
    select,
    tableName,
  })

  const table = this.tables[tableName]

  if (hasDraftsEnabled(collection)) {
    await this.execute({
      db,
      sql: sql`
        UPDATE ${table}
        SET latest = false
        WHERE ${table.id} != ${result.id}
          AND ${table.parent} = ${parent}
          AND (
            ${table.updatedAt} < ${result.updatedAt || updatedAt}
            OR (${table.updatedAt} = ${result.updatedAt || updatedAt} AND ${table.id} < ${result.id})
          )
          AND ${table.latest} IS NOT FALSE
      `,
    })

    // A higher-ranked version may have completed before this insert. Do not leave the
    // losing insert marked latest when timestamps tie or writes finish out of order.
    const newerVersion = await db.query[tableName].findFirst({
      columns: { id: true },
      where: and(
        eq(table.parent, parent),
        or(
          gt(table.updatedAt, result.updatedAt || updatedAt),
          and(eq(table.updatedAt, result.updatedAt || updatedAt), gt(table.id, result.id)),
        ),
      ),
    })

    if (newerVersion) {
      await this.execute({
        db,
        sql: sql`UPDATE ${table} SET latest = false WHERE ${table.id} = ${result.id} AND ${table.latest} IS NOT FALSE`,
      })
      result.latest = false
    }
  }

  if (returning === false) {
    return null
  }

  return result
}
