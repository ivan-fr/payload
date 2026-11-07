import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'

import { payloadParseSearch, payloadStringifySearch } from '../../utilities/routerSearch.js'
import { payloadAdminSplatRoute } from './index.js'

vi.mock('./lazy.js', () => ({ AdminNotFound: () => null, AdminPage: () => null }))

it.each([
  ['operation=update&operation=delete', { operation: ['update', 'delete'] }],
  ['operation[]=update&operation[]=delete', { 'operation[]': ['update', 'delete'] }],
  ['operation=delete', { operation: 'delete' }],
  ['filter[op]=update&filter[user]=x', { 'filter[op]': 'update', 'filter[user]': 'x' }],
  ['operation=&operation=delete', { operation: ['', 'delete'] }],
  [
    'operation[0]=update&operation[1]=delete',
    { 'operation[0]': 'update', 'operation[1]': 'delete' },
  ],
  ['where[or][0][title][equals]=hello', { 'where[or][0][title][equals]': 'hello' }],
  ['__proto__=safe&constructor=value', { ['__proto__']: 'safe', constructor: 'value' }],
])(
  'should pass Next-compatible searchParams through the real router for %s (#19410)',
  async (query, expected) => {
    const load = vi.fn(async () => ({}))
    const rootRoute = createRootRoute()
    const admin = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/$',
      ...payloadAdminSplatRoute({ load }),
    } as never)
    const router = createRouter({
      routeTree: rootRoute.addChildren([admin]),
      history: createMemoryHistory({ initialEntries: [`/admin/search-params?${query}`] }),
      parseSearch: payloadParseSearch,
      stringifySearch: payloadStringifySearch,
    })
    await router.load()
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { _splat: 'search-params', search: expected },
      }),
    )
  },
)

describe('router search serialization', () => {
  it('should retain nested query state while preserving original URL keys', () => {
    const query = '?where[or][0][title][equals]=hello&operation[]=update&operation[]=delete'
    const search = payloadParseSearch(query)

    expect(search).toMatchObject({
      operation: ['update', 'delete'],
      where: { or: [{ title: { equals: 'hello' } }] },
    })
    expect(payloadStringifySearch({ ...search })).toBe(query)
    expect(Object.keys(search)).toEqual(['where', 'operation'])
    expect(JSON.stringify(search)).not.toContain('payload.originalSearch')
  })

  it('should serialize changed search state instead of restoring a stale URL', () => {
    const search = payloadParseSearch('?operation=update&operation=delete')

    search.operation = 'create'
    expect(payloadStringifySearch(search)).toBe('?operation=create')
    expect(payloadStringifySearch({ ...search, operation: undefined })).toBe('')
  })

  it('should round-trip newly constructed nested filters without accumulating encoding', () => {
    const search = { where: { or: [{ title: { equals: 'hello & goodbye' } }] } }
    const query = payloadStringifySearch(search)

    expect(payloadStringifySearch(payloadParseSearch(query))).toBe(query)
    expect(payloadParseSearch(query)).toMatchObject(search)
  })
})
