import type { Config } from '../config/types.js'

import { compile } from 'json-schema-to-typescript'
import { describe, expect, it } from 'vitest'

import { sanitizeConfig } from '../config/sanitize.js'
import { configToJSONSchema } from './configToJSONSchema.js'

describe('explicit schema required overrides (#16797)', () => {
  it('should promote an optional conditional field when explicitly requested', async () => {
    const config = sanitizeConfig({
      collections: [
        {
          slug: 'probes',
          versions: false,
          timestamps: false,
          fields: [
            {
              name: 'amount',
              type: 'number',
              admin: { condition: () => true },
              jsonSchema: [() => ({ type: 'number', required: true })],
            },
          ],
        },
      ],
    } as Config)
    const { jsonSchema } = configToJSONSchema(config, 'text')
    const schema = jsonSchema.$defs!.probes!
    expect(schema.required).toContain('amount')
    const types = await compile(jsonSchema, 'Config')
    expect(types).toContain('amount: number')
  })

  it('should preserve the default optional conditional field and explicit opt-out', () => {
    const config = sanitizeConfig({
      collections: [
        {
          slug: 'probes',
          fields: [
            {
              name: 'conditional',
              type: 'number',
              required: true,
              admin: { condition: () => true },
            },
            {
              name: 'optional',
              type: 'number',
              required: true,
              jsonSchema: [() => ({ type: 'number', required: false })],
            },
          ],
        },
      ],
    } as Config)
    const { jsonSchema } = configToJSONSchema(config, 'text')
    expect(jsonSchema.$defs!.probes!.required ?? []).not.toContain('conditional')
    expect(jsonSchema.$defs!.probes!.required ?? []).not.toContain('optional')
  })
})
