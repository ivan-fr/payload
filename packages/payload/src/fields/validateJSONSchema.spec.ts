import { afterEach, describe, expect, it, vi } from 'vitest'

import type { JSONField } from './config/types.js'

import { validateJSONSchema } from './validateJSONSchema.js'

const schema = {
  type: 'object' as const,
  properties: { a: { type: 'number' as const } },
  required: ['a'],
}
const uri = `data:application/json,${encodeURIComponent(JSON.stringify(schema))}`

afterEach(() => vi.unstubAllGlobals())

describe('remote JSON schemas (#19399)', () => {
  it('should reject invalid values fetched from a remote schema and cache the resolved object', async () => {
    const config: NonNullable<JSONField['jsonSchema']> = { uri, fileMatch: ['*'] }
    expect(await validateJSONSchema({ jsonSchema: config, value: { a: 'x' } })).toContain('a:')
    expect(config.schema).not.toBeInstanceOf(Promise)
    expect(config.schema).toMatchObject(schema)
    expect(await validateJSONSchema({ jsonSchema: config, value: { a: 2 } })).toBe(true)
    expect(await validateJSONSchema({ jsonSchema: config, value: {} })).not.toBe(true)
  })

  it('should share an in-flight fetch across concurrent validations', async () => {
    const fetchSchema = vi.fn(async () => new Response(JSON.stringify(schema)))
    vi.stubGlobal('fetch', fetchSchema)
    const config: NonNullable<JSONField['jsonSchema']> = { uri, fileMatch: ['*'] }
    const results = await Promise.all([
      validateJSONSchema({ jsonSchema: config, value: { a: 'x' } }),
      validateJSONSchema({ jsonSchema: config, value: { a: 2 } }),
    ])
    expect(results[0]).not.toBe(true)
    expect(results[1]).toBe(true)
    expect(fetchSchema).toHaveBeenCalledTimes(1)
  })

  it('should reject failed fetches and retry instead of caching a rejected promise', async () => {
    const fetchSchema = vi
      .fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(schema)))
    vi.stubGlobal('fetch', fetchSchema)
    const config: NonNullable<JSONField['jsonSchema']> = { uri, fileMatch: ['*'] }
    expect(await validateJSONSchema({ jsonSchema: config, value: { a: 2 } })).not.toBe(true)
    expect(config.schema).toBeUndefined()
    expect(await validateJSONSchema({ jsonSchema: config, value: { a: 'x' } })).not.toBe(true)
    expect(fetchSchema).toHaveBeenCalledTimes(2)
  })

  it('should use an inline schema without fetching even when the URI is omitted at runtime', async () => {
    const fetchSchema = vi.fn()
    vi.stubGlobal('fetch', fetchSchema)
    expect(await validateJSONSchema({ jsonSchema: { schema } as never, value: { a: 2 } })).toBe(
      true,
    )
    expect(
      await validateJSONSchema({ jsonSchema: { schema } as never, value: { a: 'x' } }),
    ).not.toBe(true)
    expect(fetchSchema).not.toHaveBeenCalled()
  })
})
