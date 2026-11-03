import type { PayloadRequest } from '../../types/index.js'

import { describe, expect, it, vi } from 'vitest'

import { meOperation } from '../operations/me.js'
import { meHandler } from './me.js'

vi.mock('../operations/me.js', () => ({
  meOperation: vi.fn().mockResolvedValue({ user: { id: 'user' } }),
}))

describe('me URL draft parameter (#18072)', () => {
  it.each([
    { search: 'draft=true', query: {}, draft: true, depth: undefined },
    { search: 'draft=false&depth=2', query: {}, draft: false, depth: 2 },
    { search: 'draft=true', query: { draft: 'false' }, draft: false, depth: undefined },
    { search: 'depth=true', query: {}, draft: false, depth: undefined },
  ])(
    'should parse draft independently of depth: $search',
    async ({ search, query, draft, depth }) => {
      const req = {
        routeParams: { collection: 'users' },
        query,
        searchParams: new URLSearchParams(search),
        headers: new Headers(),
        t: () => 'Account',
        payload: {
          collections: { users: { config: { slug: 'users', auth: {} } } },
          config: { auth: { jwtOrder: [] } },
        },
      } as unknown as PayloadRequest
      const response = await meHandler(req)

      expect(response.status).toBe(200)
      expect(meOperation).toHaveBeenLastCalledWith(expect.objectContaining({ draft, depth, req }))
    },
  )
})
