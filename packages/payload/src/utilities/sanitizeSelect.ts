import type { FlattenedField } from '../fields/config/types.js'
import type { JsonObject, SelectIncludeType, SelectType } from '../types/index.js'

import { deepCopyObjectSimple } from './deepCopyObject.js'
import { getSelectMode } from './getSelectMode.js'

// Transform post.title -> post, post.category.title -> post
const stripVirtualPathToCurrentCollection = ({
  fields,
  path,
  versions,
}: {
  fields: FlattenedField[]
  path: string
  versions: boolean
}) => {
  const resultSegments: string[] = []

  if (versions) {
    resultSegments.push('version')
    const versionField = fields.find((each) => each.name === 'version')

    if (versionField && versionField.type === 'group') {
      fields = versionField.flattenedFields
    }
  }

  for (const segment of path.split('.')) {
    const field = fields.find((each) => each.name === segment)

    if (!field) {
      continue
    }

    resultSegments.push(segment)

    if (field.type === 'relationship' || field.type === 'upload') {
      return resultSegments.join('.')
    }
  }

  return resultSegments.join('.')
}

const getAllVirtualRelations = ({ fields }: { fields: FlattenedField[] }) => {
  const result: string[] = []

  for (const field of fields) {
    if ('virtual' in field && typeof field.virtual === 'string') {
      result.push(field.virtual)
    } else if (field.type === 'group' || field.type === 'tab') {
      const nestedResult = getAllVirtualRelations({ fields: field.flattenedFields })

      for (const nestedItem of nestedResult) {
        result.push(nestedItem)
      }
    }
  }

  return result
}

const resolveVirtualRelationsToSelect = ({
  fields,
  selectValue,
  topLevelFields,
  versions,
}: {
  fields: FlattenedField[]
  selectValue: SelectIncludeType | true
  topLevelFields: FlattenedField[]
  versions: boolean
}) => {
  const result: string[] = []
  if (selectValue === true) {
    for (const item of getAllVirtualRelations({ fields })) {
      result.push(
        stripVirtualPathToCurrentCollection({ fields: topLevelFields, path: item, versions }),
      )
    }
  } else {
    for (const fieldName in selectValue) {
      const field = fields.find((each) => each.name === fieldName)
      if (!field) {
        continue
      }

      if ('virtual' in field && typeof field.virtual === 'string') {
        result.push(
          stripVirtualPathToCurrentCollection({
            fields: topLevelFields,
            path: field.virtual,
            versions,
          }),
        )
      } else if (field.type === 'group' || field.type === 'tab') {
        for (const item of resolveVirtualRelationsToSelect({
          fields: field.flattenedFields,
          selectValue: selectValue[fieldName]!,
          topLevelFields,
          versions,
        })) {
          result.push(
            stripVirtualPathToCurrentCollection({ fields: topLevelFields, path: item, versions }),
          )
        }
      }
    }
  }

  return result
}

export const sanitizeSelect = ({
  fields,
  select,
  versions,
}: {
  fields: FlattenedField[]
  select?: SelectType
  versions?: boolean
}): SelectType | undefined => {
  if (!select) {
    return select
  }

  const selectMode = getSelectMode(select)

  if (selectMode === 'exclude') {
    return select
  }

  const virtualRelations = resolveVirtualRelationsToSelect({
    fields,
    selectValue: select as SelectIncludeType,
    topLevelFields: fields,
    versions: versions ?? false,
  })

  if (virtualRelations.length === 0) {
    return select
  }

  // The caller's select is never mutated. It can be a shared object, such as a collection's
  // `defaultPopulate`, or one whose serialized form is used as a cache key by the dataloader.
  const sanitizedSelect = deepCopyObjectSimple(select as JsonObject) as SelectIncludeType

  for (const path of virtualRelations) {
    let currentRef = sanitizedSelect
    const segments = path.split('.')

    for (let i = 0; i < segments.length; i++) {
      const isLast = segments.length - 1 === i
      const segment = segments[i]!
      const existingValue = currentRef[segment]

      if (existingValue === true) {
        // Everything below this segment is already selected
        break
      }

      if (isLast) {
        currentRef[segment] = true
        break
      }

      if (typeof existingValue !== 'object' || existingValue === null) {
        currentRef[segment] = {}
      }

      currentRef = currentRef[segment] as SelectIncludeType
    }
  }

  return sanitizedSelect
}
