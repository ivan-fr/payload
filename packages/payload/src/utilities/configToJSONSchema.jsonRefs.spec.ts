import type { JSONSchema4 } from 'json-schema'

import { compile } from 'json-schema-to-typescript'
import { describe, expect, it } from 'vitest'

import { sanitizeConfig } from '../config/sanitize.js'
import { configToJSONSchema } from './configToJSONSchema.js'

const recursiveSchema: JSONSchema4 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  definitions: {
    condition: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        and: { type: 'array', items: { $ref: '#/definitions/condition' } },
      },
      required: ['value'],
    },
  },
  properties: { condition: { $ref: '#/definitions/condition' } },
}

describe('embedded JSON schema references (#11383)', () => {
  it('should compile field-local recursive references without rewriting the configured validation schema', async () => {
    const before = JSON.stringify(recursiveSchema)
    const config = sanitizeConfig({
      secret: 'test',
      collections: [
        {
          slug: 'criteria',
          fields: [
            {
              name: 'filter',
              type: 'json',
              jsonSchema: { uri: 'dummy://filter.json', schema: recursiveSchema },
            },
          ],
        },
      ],
    } as never)
    const { jsonSchema } = configToJSONSchema(config, 'text')
    const types = await compile(jsonSchema, 'Config')

    expect(types).toContain('value: string')
    expect(types).toContain('and?:')
    expect(JSON.stringify(recursiveSchema)).toBe(before)
  })
})

describe('JSON schema reference scopes', () => {
  it('should keep identically named definitions of different JSON fields separate', async () => {
    const numeric = structuredClone(recursiveSchema)
    numeric.definitions!.condition.properties!.value = { type: 'number' }
    const config = sanitizeConfig({
      secret: 'test',
      collections: [
        {
          slug: 'criteria',
          fields: [
            {
              name: 'textFilter',
              type: 'json',
              jsonSchema: { uri: 'dummy://text', schema: recursiveSchema },
            },
            {
              name: 'numberFilter',
              type: 'json',
              jsonSchema: { uri: 'dummy://number', schema: numeric },
            },
          ],
        },
      ],
    } as never)
    const { jsonSchema } = configToJSONSchema(config, 'text')
    const types = await compile(jsonSchema, 'Config')

    expect(types).toContain('value: string')
    expect(types).toContain('value: number')
  })
})

import { registerJSONSchema } from './registerJSONSchema.js'

describe('JSON pointer relocation boundaries', () => {
  it('should preserve reference-looking example/default data and leave external schemas unchanged', () => {
    const definitions = new Map<string, JSONSchema4>()
    const schema = {
      ...recursiveSchema,
      default: { $ref: '#/literal-data' },
      examples: [{ $ref: '#/example-data' }],
    }
    const ref = registerJSONSchema({ schema, definitions })
    const scoped = definitions.get(ref.$ref!.split('/').pop()!)!

    expect(scoped.default).toEqual({ $ref: '#/literal-data' })
    expect(scoped.examples).toEqual([{ $ref: '#/example-data' }])
    const external = { $ref: 'https://example.com/schema.json' }

    expect(registerJSONSchema({ schema: external, definitions })).toBe(external)
  })

  it('should reuse identical scopes and avoid overwriting an existing generated definition name', () => {
    const definitions = new Map<string, JSONSchema4>()
    const first = registerJSONSchema({ schema: recursiveSchema, definitions })

    expect(registerJSONSchema({ schema: recursiveSchema, definitions })).toEqual(first)
    const name = first.$ref!.split('/').pop()!
    const occupied = new Map<string, JSONSchema4>([[name, { type: 'number' }]])
    const second = registerJSONSchema({ schema: recursiveSchema, definitions: occupied })

    expect(second).not.toEqual(first)
    expect(occupied.get(name)).toEqual({ type: 'number' })
    expect(JSON.stringify(occupied.get(second.$ref!.split('/').pop()!))).toContain(second.$ref)
  })
})
