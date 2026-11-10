import type { Where } from 'payload'

import { escapeRegExp, QueryError } from 'payload'
import { wordBoundariesRegex } from 'payload/shared'

type Args = { collection: string; where: Where }

/** Resolve the synthetic relationTo value before querying one physical collection. */
export const specializeJoinQuery = ({ collection, where }: Args): null | Where => {
  const result: Where = {}
  for (const [key, value] of Object.entries(where)) {
    const clause = specializeClause({ collection, key, value })
    if (clause === null) {
      return null
    }
    Object.assign(result, clause)
  }
  return result
}

const specializeClause = ({
  collection,
  key,
  value,
}: {
  collection: string
  key: string
  value: Where[string]
}): null | Where => {
  if ((key === 'and' || key === 'or') && Array.isArray(value)) {
    const branches = value.map((where) => specializeJoinQuery({ collection, where }))
    return combineBranches({ branches, key })
  }
  if (key === 'relationTo') {
    return matchesCollection({ collection, condition: value }) ? {} : null
  }
  return { [key]: value }
}

const combineBranches = ({
  branches,
  key,
}: {
  branches: (null | Where)[]
  key: 'and' | 'or'
}): null | Where => {
  if (key === 'and' && branches.includes(null)) {
    return null
  }
  if (key === 'or' && branches.some((branch) => branch && Object.keys(branch).length === 0)) {
    return {}
  }
  const conditions = branches.filter(
    (branch): branch is Where => branch !== null && Object.keys(branch).length > 0,
  )
  if (key === 'or' && conditions.length === 0) {
    return null
  }
  return conditions.length > 0 ? { [key]: conditions } : {}
}

const matchesCollection = ({
  collection,
  condition,
}: {
  collection: string
  condition: unknown
}): boolean => {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    throw new QueryError([{ path: 'relationTo' }])
  }
  return Object.entries(condition).every(([operator, value]) => {
    switch (operator) {
      case 'contains':
        return new RegExp(escapeRegExp(String(value)), 'i').test(collection)
      case 'equals':
        return collection === value
      case 'exists':
        return value === true || value === 'true'
      case 'greater_than':
        return collection > String(value)
      case 'greater_than_equal':
        return collection >= String(value)
      case 'in':
        return getValues({ value }).includes(collection)
      case 'less_than':
        return collection < String(value)
      case 'less_than_equal':
        return collection <= String(value)
      case 'like':
        return wordBoundariesRegex(String(value)).test(collection)
      case 'not_equals':
        return collection !== value
      case 'not_in':
        return !getValues({ value }).includes(collection)
      case 'not_like':
        return !wordBoundariesRegex(String(value)).test(collection)
      default:
        throw new QueryError([{ path: `relationTo.${operator}` }])
    }
  })
}

const getValues = ({ value }: { value: unknown }): unknown[] =>
  Array.isArray(value) ? value : String(value).split(',')
