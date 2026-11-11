import type { JSONSchema4 } from 'json-schema'
import type { core } from 'zod'

import type { JSONFieldValidationSchema } from './config/types.js'

type Args = {
  jsonSchema: JSONFieldValidationSchema
  value: unknown
}

/**
 * Validates a JSON field value against the field's `jsonSchema`.
 *
 * `validations.ts` imports this through `#validateJSONSchema`, and `package.json` gives browsers
 * `validateJSONSchema.browser.ts` instead. `jsonSchema` is a server-only field property, so the
 * admin never validates JSON Schemas in the browser, and doesn't need to compile or download zod.
 */
export const validateJSONSchema = async ({ jsonSchema, value }: Args): Promise<string | true> => {
  try {
    const schema = await fetchSchema({ jsonSchema })
    const { fromJSONSchema } = await import('zod')
    // `JSONSchema4` allows any string for `$schema`, while zod narrows it to the three drafts it
    // supports. zod ignores `$schema` at runtime, so the wider type is safe to pass through.
    const zodSchema = fromJSONSchema(schema as core.JSONSchema.JSONSchema)

    const result = zodSchema.safeParse(value)

    if (!result.success) {
      return result.error.issues
        .map((issue) =>
          issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
        )
        .join(', ')
    }
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown error'
  }

  return true
}

const pendingSchemas = new WeakMap<Args['jsonSchema'], Promise<JSONSchema4>>()

async function fetchSchema({ jsonSchema }: Pick<Args, 'jsonSchema'>): Promise<JSONSchema4> {
  if (jsonSchema.schema) {
    return jsonSchema.schema
  }

  let pending = pendingSchemas.get(jsonSchema)
  if (!pending) {
    pending = fetch(jsonSchema.uri).then(async (response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      const schema = (await response.json()) as JSONSchema4
      if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        throw new Error('JSON Schema must be an object')
      }
      return {
        ...schema,
        id: undefined,
        $id: schema.$id ?? schema.id,
        $schema: schema.$schema ?? 'http://json-schema.org/draft-07/schema#',
      }
    })
    pendingSchemas.set(jsonSchema, pending)
  }

  try {
    const schema = await pending
    jsonSchema.schema = schema
    return schema
  } finally {
    if (pendingSchemas.get(jsonSchema) === pending) {
      pendingSchemas.delete(jsonSchema)
    }
  }
}
