import { expect, it, vi } from 'vitest'

import { multiTenantPlugin } from '../../index.js'
import { GlobalViewRedirect } from './index.js'

it.each([false, true])(
  'should redirect using the registered membership field names (custom: %s) (#19420)',
  async (isCustom) => {
    const arrayField = isCustom ? 'memberships' : 'tenants'
    const tenantField = isCustom ? 'organization' : 'tenant'
    const plugin = multiTenantPlugin({
      collections: { settings: { isGlobal: true } },
      tenantsArrayField: { arrayFieldName: arrayField, arrayTenantFieldName: tenantField },
      userHasAccessToAllTenants: () => false,
    })
    const config = await plugin({
      collections: [
        { slug: 'users', auth: true, fields: [] },
        { slug: 'tenants', fields: [] },
        { slug: 'settings', fields: [] },
      ],
    })
    const action = config.admin!.components!.actions!.find(
      (action) => typeof action === 'object' && action.path?.endsWith('#GlobalViewRedirect'),
    ) as { serverProps: Record<string, unknown> }
    const user = { id: 'editor', [arrayField]: [{ [tenantField]: 'tenant-a' }] }
    const find = vi.fn(async ({ collection, where }) => {
      if (collection === 'tenants') {
        return { docs: where?.id?.in?.includes('tenant-a') ? [{ id: 'tenant-a' }] : [] }
      }
      return { docs: [{ id: 'settings-a' }] }
    })
    const redirect = vi.fn()
    await GlobalViewRedirect({
      ...action.serverProps,
      collectionSlug: 'settings',
      viewType: 'list',
      user,
      payload: {
        config: { routes: { admin: '/admin' }, serverURL: '' },
        collections: { tenants: { config: {} } },
        db: { defaultIDType: 'text' },
        find,
        logger: { error: vi.fn() },
      },
      server: { getHeaders: async () => new Headers(), redirect },
    } as never)
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/admin/collections/settings/settings-a')
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        overrideAccess: false,
        user,
        where: { id: { in: ['tenant-a'] } },
      }),
    )
  },
)
