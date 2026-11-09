import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { TenantSelectionProviderClient, useTenantSelection } from './index.client.js'

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'editor' } as { id: string } | null },
  router: { refresh: vi.fn() },
  error: vi.fn(),
  config: { routes: { api: '/api' } },
}))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => mocks.auth,
  useConfig: () => ({ config: mocks.config }),
  useRouter: () => mocks.router,
  toast: { error: mocks.error },
}))
const options = [
  { label: 'Tenant A', value: 'a' },
  { label: 'Tenant B', value: 'b' },
]
function Probe() {
  const { selectedTenantID, setTenant, syncTenants } = useTenantSelection()
  return (
    <>
      <output>{selectedTenantID ?? 'all'}</output>
      <button onClick={() => setTenant({ id: undefined })}>Clear</button>
      <button onClick={() => void syncTenants()}>Sync</button>
    </>
  )
}
beforeEach(() => {
  vi.stubGlobal('process', { env: {} })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})
afterEach(() => {
  document.cookie = 'payload-tenant=; Max-Age=-1; Path=/'
  vi.unstubAllGlobals()
  mocks.router.refresh.mockClear()
  mocks.error.mockClear()
  mocks.auth.user = { id: 'editor' }
})
it('should preserve a tenant cookie while server authentication is unavailable (#17684)', async () => {
  document.cookie = 'payload-tenant=b; Path=/'
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      json: async () => ({ tenantOptions: options, canAccessAllTenants: false }),
    })),
  )
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(async () => {
      root.render(
        <TenantSelectionProviderClient
          initialTenantOptions={[]}
          hasValidatedTenantOptions={false}
          tenantsCollectionSlug="tenants"
        >
          <Probe />
        </TenantSelectionProviderClient>,
      )
    })
    expect(document.cookie).toContain('payload-tenant=b')
    expect(fetch).toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(host.querySelector('output')!.textContent).toBe('b')
    expect(mocks.router.refresh.mock.calls.length).toBeLessThanOrEqual(1)
    await act(() =>
      root.render(
        <TenantSelectionProviderClient
          initialTenantOptions={options}
          initialValue="b"
          hasValidatedTenantOptions
          tenantsCollectionSlug="tenants"
        >
          <Probe />
        </TenantSelectionProviderClient>,
      ),
    )
    expect(host.querySelector('output')!.textContent).toBe('b')
  } finally {
    await act(() => root.unmount())
  }
})
it('should keep an all-tenants selection with one accessible tenant, including after sync (#17833)', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      json: async () => ({ tenantOptions: options.slice(0, 1), canAccessAllTenants: true }),
    })),
  )
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(() =>
      root.render(
        <TenantSelectionProviderClient
          canAccessAllTenants
          initialTenantOptions={options.slice(0, 1)}
          tenantsCollectionSlug="tenants"
        >
          <Probe />
        </TenantSelectionProviderClient>,
      ),
    )
    expect(host.querySelector('output')!.textContent).toBe('all')
    await act(async () => {
      host.querySelectorAll('button')[1]!.click()
    })
    expect(fetch).toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(host.querySelector('output')!.textContent).toBe('all')
    expect(document.cookie).not.toContain('payload-tenant=')
    await act(() => host.querySelector('button')!.click())
    expect(host.querySelector('output')!.textContent).toBe('all')
  } finally {
    await act(() => root.unmount())
  }
})
it('should continue auto-selecting the only tenant for a regular tenant user', async () => {
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(() =>
      root.render(
        <TenantSelectionProviderClient
          initialTenantOptions={options.slice(0, 1)}
          tenantsCollectionSlug="tenants"
        >
          <Probe />
        </TenantSelectionProviderClient>,
      ),
    )
    expect(host.querySelector('output')!.textContent).toBe('a')
    await act(() => host.querySelector('button')!.click())
    expect(host.querySelector('output')!.textContent).toBe('a')
  } finally {
    await act(() => root.unmount())
  }
})

it('should clear a cookie when the authenticated server has confirmed there are no accessible tenants', async () => {
  document.cookie = 'payload-tenant=revoked; Path=/'
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ json: async () => ({ tenantOptions: [], canAccessAllTenants: false }) })),
  )
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        <TenantSelectionProviderClient
          hasValidatedTenantOptions
          initialTenantOptions={[]}
          tenantsCollectionSlug="tenants"
        >
          <Probe />
        </TenantSelectionProviderClient>,
      ),
    )
    expect(document.cookie).not.toContain('payload-tenant=')
    expect(host.querySelector('output')!.textContent).toBe('all')
    expect(mocks.router.refresh).toHaveBeenCalledOnce()
  } finally {
    await act(() => root.unmount())
  }
})
it('should discard a tenant sync response after logout', async () => {
  document.cookie = 'payload-tenant=b; Path=/'
  let resolve!: (result: { json: () => Promise<unknown> }) => void
  const pending = new Promise<{ json: () => Promise<unknown> }>((done) => {
    resolve = done
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(() => pending),
  )
  const host = document.createElement('div')
  const root = createRoot(host)
  const initialTenantOptions: typeof options = []
  const render = () =>
    root.render(
      <TenantSelectionProviderClient
        hasValidatedTenantOptions={false}
        initialTenantOptions={initialTenantOptions}
        tenantsCollectionSlug="tenants"
      >
        <Probe />
      </TenantSelectionProviderClient>,
    )
  try {
    await act(render)
    expect(fetch).toHaveBeenCalled()
    mocks.auth.user = null
    await act(render)
    await act(async () =>
      resolve({ json: async () => ({ tenantOptions: options, canAccessAllTenants: true }) }),
    )
    expect(host.querySelector('output')!.textContent).toBe('all')
    expect(document.cookie).not.toContain('payload-tenant=')
  } finally {
    await act(() => root.unmount())
  }
})
