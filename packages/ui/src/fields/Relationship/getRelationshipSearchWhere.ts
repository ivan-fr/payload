import type { ClientCollectionConfig, Where } from 'payload'

import { flattenTopLevelFields } from 'payload/shared'

/** Returns false when this collection cannot match the current search term. */
export const getRelationshipSearchWhere = ({
  collection,
  search,
}: {
  collection: ClientCollectionConfig
  search?: string
}): false | undefined | Where => {
  if (!search) {
    return undefined
  }
  const path = collection.admin.useAsTitle || 'id'
  const field = flattenTopLevelFields(collection.fields, { moveSubFieldsToTop: true }).find(
    (field) => (field.accessor || field.name) === path,
  )
  if (field?.type === 'number') {
    const value = Number(search)
    return search.trim() && Number.isFinite(value) ? { [path]: { equals: value } } : false
  }
  return { [path]: { like: search } }
}
