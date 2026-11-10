import type { Config } from '../config/types.js'

import { describe, expect, it } from 'vitest'

import { sanitizeConfig } from '../config/sanitize.js'
import { configToJSONSchema } from './configToJSONSchema.js'

describe('JSON field schema transforms (#19401)', () => {
  it('should generate transformed schemas for array and validation-object forms', () => {
    const config = sanitizeConfig({
      collections: [
        {
          slug: 'records',
          fields: [
            {
              name: 'tags',
              type: 'json',
              jsonSchema: [() => ({ type: 'array', items: { type: 'string' } })],
            },
            {
              name: 'validated',
              type: 'json',
              jsonSchema: {
                uri: 'urn:tags',
                fileMatch: ['*'],
                schema: { type: 'array', items: { type: 'string' } },
                transforms: [
                  ({ jsonSchema, variant }) => ({ ...jsonSchema, description: variant }),
                ],
              },
            },
          ],
        },
      ],
    } as Config)
    const { jsonSchema } = configToJSONSchema(config, 'text')
    const properties = jsonSchema.$defs.records.properties

    expect(properties.tags).toMatchObject({ type: 'array', items: { type: 'string' } })
    expect(properties.validated).toMatchObject({
      type: 'array',
      items: { type: 'string' },
      description: 'output',
    })
  })
})
