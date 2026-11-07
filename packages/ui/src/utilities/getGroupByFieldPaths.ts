import type { ClientField, Field } from 'payload'

import { isFieldDisabled } from 'payload/shared'

const supportedTypes = new Set<Field['type']>([
  'checkbox',
  'date',
  'email',
  'number',
  'radio',
  'relationship',
  'select',
  'text',
  'textarea',
  'upload',
])

type GroupingField = ClientField | Field

/** A group key must resolve to one scalar value per document, never an array/block descendant. */
export const getGroupByFieldPaths = ({
  fields,
  parentPath = '',
}: {
  fields: readonly GroupingField[]
  parentPath?: string
}): Set<string> => new Set(fields.flatMap((field) => getFieldPaths({ field, parentPath })))

const getQueryName = ({ field }: { field: GroupingField }): string => {
  if ('virtual' in field && typeof field.virtual === 'string') {
    return field.virtual
  }
  return 'name' in field ? field.name : ''
}

const getFieldPaths = ({
  field,
  parentPath,
}: {
  field: GroupingField
  parentPath: string
}): string[] => {
  if (isFieldDisabled(field, 'groupBy') || ('virtual' in field && field.virtual === true)) {
    return []
  }
  if (field.type === 'array' || field.type === 'blocks' || field.type === 'join') {
    return []
  }
  if (field.type === 'tabs') {
    return field.tabs.flatMap((tab) => [
      ...getGroupByFieldPaths({
        fields: tab.fields,
        parentPath: 'name' in tab && tab.name ? `${parentPath}${tab.name}.` : parentPath,
      }),
    ])
  }
  const queryName = getQueryName({ field })
  const path = `${parentPath}${queryName}`

  if ('fields' in field) {
    return [
      ...getGroupByFieldPaths({
        fields: field.fields,
        parentPath: queryName ? `${path}.` : parentPath,
      }),
    ]
  }
  if (!supportedTypes.has(field.type) || ('hasMany' in field && field.hasMany)) {
    return []
  }
  return path === 'id' ? [] : [path]
}

export const resolveGroupBy = ({
  fields,
  groupBy,
}: {
  fields: readonly (ClientField | Field)[]
  groupBy: unknown
}): string =>
  typeof groupBy === 'string' && getGroupByFieldPaths({ fields }).has(groupBy.replace(/^-/, ''))
    ? groupBy
    : ''
