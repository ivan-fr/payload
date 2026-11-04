import type { CollectionConfig } from '../../collections/config/types.js'
import type { Field } from '../../fields/config/types.js'

export function findUseAsTitleField(collectionConfig: CollectionConfig): {
  localized: boolean
  titleFieldName: string
} {
  const titleFieldName = collectionConfig.admin?.useAsTitle || 'id'
  const result = iterateFields({ fields: collectionConfig.fields, titleFieldName })
  if (!result) {
    throw new Error(
      `The hierarchy title field "${titleFieldName}" was not found. It cannot be nested within named fields i.e. named groups, named tabs, etc.`,
    )
  }
  return result
}

/**
 * Find a field by name and return its localization status.
 * Returns undefined if field is not found.
 */
export function findFieldByName(
  collectionConfig: CollectionConfig,
  fieldName: string,
): { fieldName: string; localized: boolean } | undefined {
  const result = iterateFields({ fields: collectionConfig.fields, titleFieldName: fieldName })
  return result ? { fieldName: result.titleFieldName, localized: result.localized } : undefined
}

function iterateFields({
  fields,
  titleFieldName,
}: {
  fields: Field[]
  titleFieldName: string
}): { localized: boolean; titleFieldName: string } | undefined {
  if (titleFieldName === 'id') {
    return { localized: false, titleFieldName }
  }
  for (const field of fields) {
    if (
      (field.type === 'text' || field.type === 'number' || field.type === 'textarea') &&
      field.name === titleFieldName
    ) {
      return { localized: Boolean(field.localized), titleFieldName: field.name }
    }
    const result = iterateFields({ fields: getUnnamedLayoutFields({ field }), titleFieldName })
    if (result) {
      return result
    }
  }
  return undefined
}

function getUnnamedLayoutFields({ field }: { field: Field }): Field[] {
  switch (field.type) {
    case 'collapsible':
    case 'row':
      return field.fields
    case 'group':
      return 'name' in field ? [] : field.fields
    case 'tabs':
      return field.tabs.flatMap((tab) => ('name' in tab ? [] : tab.fields))
    default:
      return []
  }
}
