import { describe, expect, it, vi } from 'vitest'

import { getTenantOptionsEndpoint } from '../../endpoints/getTenantOptionsEndpoint.js'
import { TenantSelectionProvider } from './index.js'

vi.mock('./index.client.js', () => ({ TenantSelectionProviderClient: () => null }))

const createArgs = ({
  canAccessAllTenants = false,
  cookie,
  user = { id: 'editor', tenants: [{ tenant: 'a' }] },
}: {
  canAccessAllTenants?: boolean
  cookie?: string
  user?: Record<string, unknown> | null
} = {}) => ({
  children: null,
  payload: {
    collections: { tenants: { config: {} } },
    find: vi.fn(async () => ({ docs: [{ id: 'a', name: 'Tenant A' }] })),
  },
  server: {
    getCookies: async () => new Map(cookie ? [['payload-tenant', { value: cookie }]] : []),
  },
  tenantsArrayFieldName: 'tenants',
  tenantsArrayTenantFieldName: 'tenant',
  tenantsCollectionSlug: 'tenants',
  useAsTitle: 'name',
  user,
  userHasAccessToAllTenants: () => canAccessAllTenants,
})

describe('tenant selection server policy (#17684, #17833)', () => {
  it.each([false, true])(
    'should default the only tenant only for a restricted user (all: %s)',
    async (canAccessAllTenants) => {
      const args = createArgs({ canAccessAllTenants })
      const result = await TenantSelectionProvider(args as never)
      expect(result.props.initialValue).toBe(canAccessAllTenants ? undefined : 'a')
      expect(result.props.canAccessAllTenants).toBe(canAccessAllTenants)
      expect(result.props.hasValidatedTenantOptions).toBe(true)
      expect(args.payload.find).toHaveBeenCalledWith(
        expect.objectContaining({ overrideAccess: false, user: args.user }),
      )
    },
  )
  it('should retain an explicit valid cookie for an all-tenants user', async () => {
    const result = await TenantSelectionProvider(
      createArgs({ canAccessAllTenants: true, cookie: 'a' }) as never,
    )
    expect(result.props.initialValue).toBe('a')
  })
  it('should mark unauthenticated server options as unavailable rather than an invalid selection', async () => {
    const args = createArgs({ user: null, cookie: 'a' })
    const result = await TenantSelectionProvider(args as never)
    expect(result.props.hasValidatedTenantOptions).toBe(false)
    expect(result.props.initialValue).toBeUndefined()
    expect(args.payload.find).not.toHaveBeenCalled()
  })
  it('should return the authenticated selection policy when refreshing tenant options', async () => {
    const args = createArgs({ canAccessAllTenants: true })
    const endpoint = getTenantOptionsEndpoint(args as never)
    const response = await endpoint.handler({ user: args.user, payload: args.payload } as never)
    expect(await response.json()).toEqual({
      canAccessAllTenants: true,
      tenantOptions: [{ label: 'Tenant A', value: 'a' }],
    })
    expect(args.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: false, user: args.user }),
    )
  })
  it('should reject option refreshes without authentication', async () => {
    const args = createArgs({ user: null })
    const endpoint = getTenantOptionsEndpoint(args as never)
    await expect(
      endpoint.handler({ user: null, payload: args.payload } as never),
    ).rejects.toMatchObject({ status: 401 })
    expect(args.payload.find).not.toHaveBeenCalled()
  })
})
