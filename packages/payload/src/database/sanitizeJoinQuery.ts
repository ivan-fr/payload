import type { SanitizedCollectionConfig, SanitizedJoin } from '../collections/config/types.js'
import type { JoinQuery, PayloadRequest, Where } from '../types/index.js'

import { executeAccess } from '../auth/executeAccess.js'
import { QueryError } from '../errors/QueryError.js'
import { deepCopyObjectSimple } from '../utilities/deepCopyObject.js'
import { combineQueries } from './combineQueries.js'
import { validateQueryPaths } from './queryValidation/validateQueryPaths.js'
import { validateSortQuery } from './queryValidation/validateSortQuery.js'
import { sanitizeWhereQuery } from './sanitizeWhereQuery.js'

type Args = {
  collectionConfig: SanitizedCollectionConfig
  joins?: JoinQuery
  overrideAccess: boolean
  req: PayloadRequest
}

const sanitizeJoinFieldQuery = async ({
  collectionSlug,
  errors,
  join,
  joinsQuery,
  overrideAccess,
  promises,
  req,
  validationWhere,
}: {
  collectionSlug: string
  errors: { path: string }[]
  join: SanitizedJoin
  joinsQuery: JoinQuery
  overrideAccess: boolean
  promises: Promise<void>[]
  req: PayloadRequest
  validationWhere?: Where
}) => {
  const { joinPath } = join
  const isPolymorphic = Array.isArray(join.field.collection)

  // TODO: fix any's in joinsQuery[joinPath]

  if ((joinsQuery as any)[joinPath] === false) {
    return
  }

  const joinCollectionConfig = req.payload.collections[collectionSlug]!.config

  const accessResult = !overrideAccess
    ? await executeAccess(
        { slug: joinCollectionConfig.slug, disableErrors: true, req },
        joinCollectionConfig.access.read,
      )
    : true

  if (accessResult === false && !isPolymorphic) {
    ;(joinsQuery as any)[joinPath] = false
    return
  }

  if (!(joinsQuery as any)[joinPath]) {
    ;(joinsQuery as any)[joinPath] = {}
  }

  const joinQuery = (joinsQuery as any)[joinPath]

  if (!joinQuery.where) {
    joinQuery.where = {}
  }

  if (join.field.where && !isPolymorphic) {
    joinQuery.where = combineQueries(joinQuery.where, deepCopyObjectSimple(join.field.where))
  }

  if (accessResult === false) {
    joinQuery.where = combineQueries(joinQuery.where, {
      relationTo: { not_equals: collectionSlug },
    })
    return
  }

  promises.push(
    validateQueryPaths({
      collectionConfig: joinCollectionConfig,
      errors,
      overrideAccess,
      polymorphicJoin: Array.isArray(join.field.collection),
      req,
      // incoming where input, but we shouldn't validate generated from the access control.
      where: validationWhere ?? joinQuery.where,
    }),
    validateSortQuery({
      collectionConfig: joinCollectionConfig,
      overrideAccess,
      req,
      sort: joinQuery.sort || join.field.defaultSort || joinCollectionConfig.defaultSort,
    }),
  )

  if (typeof accessResult === 'object') {
    sanitizeWhereQuery({
      fields: joinCollectionConfig.flattenedFields,
      payload: req.payload,
      where: accessResult,
    })
    joinQuery.where = combineQueries(
      joinQuery.where,
      isPolymorphic
        ? { or: [{ relationTo: { not_equals: collectionSlug } }, accessResult] }
        : accessResult,
    )
  }
}

/**
 * * Validates `where` for each join
 * * Combines the access result for joined collection
 * * Combines the default join's `where`
 */
export const sanitizeJoinQuery = async ({
  collectionConfig,
  joins: joinsQuery,
  overrideAccess,
  req,
}: Args) => {
  if (joinsQuery === false) {
    return false
  }

  if (!joinsQuery) {
    joinsQuery = {}
  }

  const errors: { path: string }[] = []
  const promises: Promise<void>[] = []

  for (const collectionSlug in collectionConfig.joins) {
    for (const join of collectionConfig.joins[collectionSlug]!) {
      await sanitizeJoinFieldQuery({
        collectionSlug,
        errors,
        join,
        joinsQuery,
        overrideAccess,
        promises,
        req,
      })
    }
  }

  for (const join of collectionConfig.polymorphicJoins) {
    const joinQueries = joinsQuery as Record<string, { where?: Where } | false>
    const incomingJoinQuery = joinQueries[join.joinPath]

    if (incomingJoinQuery === false) {
      continue
    }

    const joinQuery = incomingJoinQuery ?? {}
    joinQueries[join.joinPath] = joinQuery
    const validationWhere = combineQueries(
      deepCopyObjectSimple(joinQuery.where ?? {}),
      deepCopyObjectSimple(join.field.where ?? {}),
    )

    joinQuery.where = validationWhere

    for (const collectionSlug of join.field.collection) {
      await sanitizeJoinFieldQuery({
        collectionSlug,
        errors,
        join,
        joinsQuery,
        overrideAccess,
        promises,
        req,
        validationWhere,
      })
    }
  }

  await Promise.all(promises)

  if (errors.length > 0) {
    throw new QueryError(errors)
  }

  return joinsQuery
}
