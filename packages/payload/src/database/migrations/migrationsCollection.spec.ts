import type { Config } from '../../config/types.js'
import type { PayloadRequest } from '../../types/index.js'

import { describe, expect, it } from 'vitest'

import { sanitizeConfig } from '../../config/sanitize.js'

describe('migration collection access (#19204)', () => {
  it.each(['create', 'read', 'update', 'delete'] as const)(
    'should deny enforced %s access even to authenticated admin users',
    async (operation) => {
      const config = sanitizeConfig({
        secret: 'test-secret',
        db: { defaultIDType: 'text', init: () => ({}) } as never,
        collections: [{ slug: 'users', auth: true, fields: [] }],
      } as Config)
      const collection = config.collections.find(({ slug }) => slug === 'payload-migrations')!
      const req = {
        payload: { config },
        user: { id: 'viewer', collection: 'users' },
      } as unknown as PayloadRequest

      expect(await collection.access[operation]({ req })).toBe(false)
      expect(collection.endpoints).toBe(false)
      expect(collection.graphQL).toBe(false)
    },
  )
})
