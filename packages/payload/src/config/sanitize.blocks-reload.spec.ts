import type { Block } from '../fields/config/types.js'
import type { Config } from './types.js'

import { describe, expect, it } from 'vitest'

import { sanitizeConfig } from './sanitize.js'

describe('shared blocks across config reloads', () => {
  it('should retain already-sanitized blocks without adding duplicate base fields', () => {
    const block: Block = { slug: 'text', fields: [{ name: 'content', type: 'textarea' }] }
    const makeConfig = (): Config => ({
      blocks: [block],
      db: { defaultIDType: 'text', init: () => ({}) } as never,
      secret: 'test-secret',
    })
    const initial = sanitizeConfig(makeConfig())

    for (let reload = 0; reload < 2; reload++) {
      const next = sanitizeConfig(makeConfig())

      expect(next.blocks).toEqual(initial.blocks)
      expect(next.blocks).toHaveLength(1)
      expect(next.blocks[0]?.flattenedFields.some((field) => field.name === 'content')).toBe(true)
      expect(
        next.blocks[0]?.fields.filter((field) => 'name' in field && field.name === 'id'),
      ).toHaveLength(1)
    }
  })
})
