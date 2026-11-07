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

/** A group key must resolve to one scalar value per document, never an array/block descendant. */
export const getGroupByFieldPaths = ({
  fields,
  parentPath = '',
}: {
  fields: readonly (ClientField | Field)[]
  parentPath?: string
}): Set<string> => {
  const paths = new Set<string>()
  const append = (args: { fields: readonly (ClientField | Field)[]; parentPath: string }) => {
    for (const path of getGroupByFieldPaths(args)) {
      paths.add(path)
    }
  }

  for (const field of fields) {
    if (isFieldDisabled(field, 'groupBy') || ('virtual' in field && field.virtual === true)) {
      continue
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        append({
          fields: tab.fields,
          parentPath: 'name' in tab && tab.name ? `${parentPath}${tab.name}.` : parentPath,
        })
      }
      continue
    }
    if (field.type === 'array' || field.type === 'blocks' || field.type === 'join') {
      continue
    }
    if ('fields' in field) {
      append({
        fields: field.fields,
        parentPath: 'name' in field && field.name ? `${parentPath}${field.name}.` : parentPath,
      })
      continue
    }
    if (
      'name' in field &&
      supportedTypes.has(field.type) &&
      !('hasMany' in field && field.hasMany)
    ) {
      const queryPath =
        'virtual' in field && typeof field.virtual === 'string' ? field.virtual : field.name
      const path = `${parentPath}${queryPath}`
      if (path !== 'id') {
        paths.add(path)
      }
    }
  }

  return paths
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
