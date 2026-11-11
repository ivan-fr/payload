import type { JSONSchema4 } from 'json-schema'

import { createHash } from 'node:crypto'

const schemaMaps = new Set([
  '$defs',
  'definitions',
  'dependentSchemas',
  'patternProperties',
  'properties',
])
const schemaArrays = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems'])
const schemaSingles = new Set([
  'additionalItems',
  'additionalProperties',
  'contains',
  'else',
  'if',
  'not',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
])

/** Keep a JSON field's local pointer references inside its own schema when embedding it. */
export function registerJSONSchema({
  definitions,
  schema,
}: {
  definitions: Map<string, JSONSchema4>
  schema: JSONSchema4
}): JSONSchema4 {
  let hasLocalReferences = false
  visitSchema({
    schema,
    visit: (node) => {
      if (typeof node.$ref === 'string' && (node.$ref === '#' || node.$ref.startsWith('#/'))) {
        hasLocalReferences = true
      }
      return node
    },
  })
  if (!hasLocalReferences) {
    return schema
  }

  const hash = createHash('sha256').update(JSON.stringify(schema)).digest('hex').slice(0, 16)
  const baseName = `JSONField_${hash}`
  let name = baseName
  let suffix = 0

  while (true) {
    const scopedSchema = visitSchema({
      schema,
      visit: (node) => {
        const ref = node.$ref
        return typeof ref === 'string' && (ref === '#' || ref.startsWith('#/'))
          ? { ...node, $ref: `#/$defs/${name}${ref.slice(1)}` }
          : node
      },
    })
    const existing = definitions.get(name)

    if (!existing || JSON.stringify(existing) === JSON.stringify(scopedSchema)) {
      definitions.set(name, scopedSchema)
      return { $ref: `#/$defs/${name}` }
    }
    suffix += 1
    name = `${baseName}_${suffix}`
  }
}

function visitSchema({
  isRoot = true,
  schema,
  visit,
}: {
  isRoot?: boolean
  schema: JSONSchema4
  visit: (schema: JSONSchema4) => JSONSchema4
}): JSONSchema4 {
  if (!isRoot && (schema.$id || schema.id)) {
    return schema
  }
  const result = { ...schema }

  for (const [key, value] of Object.entries(schema)) {
    if (schemaMaps.has(key) || key === 'dependencies') {
      result[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([name, child]) => [
          name,
          typeof child === 'object' && child !== null && !Array.isArray(child)
            ? visitSchema({ isRoot: false, schema: child as JSONSchema4, visit })
            : child,
        ]),
      )
    } else if (schemaArrays.has(key) || (key === 'items' && Array.isArray(value))) {
      result[key] = (value as JSONSchema4[]).map((child) =>
        typeof child === 'object' && child !== null
          ? visitSchema({ isRoot: false, schema: child, visit })
          : child,
      )
    } else if (
      (schemaSingles.has(key) || key === 'items') &&
      typeof value === 'object' &&
      value !== null
    ) {
      result[key] = visitSchema({ isRoot: false, schema: value as JSONSchema4, visit })
    }
  }
  return visit(result)
}
