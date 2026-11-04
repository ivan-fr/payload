import type { FlattenedField, Where } from 'payload'

import { getFieldByPath } from 'payload'

/** Keep unfilled picker rows in the UI while omitting them from the document query. */
export const sanitizeListFilterQuery = ({
  fields,
  where,
}: {
  fields: FlattenedField[]
  where?: Where
}): Where => {
  const result: Where = {}
  for (const [path, condition] of Object.entries(where ?? {})) {
    if ((path === 'and' || path === 'or') && Array.isArray(condition)) {
      const clauses = condition
        .map((where) => sanitizeListFilterQuery({ fields, where }))
        .filter((where) => Object.keys(where).length > 0)
      if (clauses.length > 0) {
        result[path] = clauses
      }
      continue
    }

    const field = getFieldByPath({ fields, path })?.field
    if (
      field &&
      ['relationship', 'select', 'upload'].includes(field.type) &&
      condition &&
      typeof condition === 'object' &&
      !Array.isArray(condition)
    ) {
      const operators = Object.fromEntries(
        Object.entries(condition).filter(([, value]) => value !== '' && value !== undefined),
      )
      if (Object.keys(operators).length > 0) {
        result[path] = operators
      }
    } else {
      result[path] = condition
    }
  }
  return result
}
