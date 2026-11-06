import type { AuthenticatedUser } from 'payload'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from '../../providers/Auth/index.js'
import { LogoutClient } from './LogoutClient.js'

const mocks = vi.hoisted(() => ({
  config: {
    admin: { routes: { inactivity: '/logout-inactivity', login: '/login' }, user: 'users' },
    routes: { admin: '/admin', api: '/api' },
  },
  get: vi.fn(),
  post: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
  searchParams: new URLSearchParams(),
  sessionTimers: {
    clear: vi.fn(),
    getCurrentExpirationMs: vi.fn(),
    recordActivity: vi.fn(),
    scheduleRefresh: vi.fn(),
    setExpiration: vi.fn(),
  },
  tabSessionSync: { broadcast: vi.fn(), broadcastLogoutSettlement: vi.fn() },
  translation: { i18n: { language: 'en' }, t: (key: string) => key },
}))

vi.mock('@faceless-ui/modal', () => ({
  useModal: () => ({ closeAllModals: vi.fn(), openModal: vi.fn() }),
}))
vi.mock('../../elements/StayLoggedIn/index.js', () => ({ stayLoggedInModalSlug: 'stay-logged-in' }))
vi.mock('../../elements/Button/index.js', () => ({ Button: () => null }))
vi.mock('../../elements/Loading/index.js', () => ({ LoadingOverlay: () => null }))
vi.mock('../../providers/Config/index.js', () => ({ useConfig: () => ({ config: mocks.config }) }))
vi.mock('../../providers/Translation/index.js', () => ({ useTranslation: () => mocks.translation }))
vi.mock('../../providers/RouterAdapter/index.js', () => ({
  usePathname: () => '/admin/logout',
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.searchParams,
}))
vi.mock('../../providers/RouteTransition/index.js', () => ({
  useRouteTransition: () => ({ startRouteTransition: (callback: () => void) => callback() }),
}))
vi.mock('../../providers/Auth/useAuthSessionTimers.js', () => ({
  useAuthSessionTimers: () => mocks.sessionTimers,
}))
vi.mock('../../providers/Auth/tabSessionSync/useTabSessionSync.js', () => ({
  useTabSessionSync: () => mocks.tabSessionSync,
}))
vi.mock('../../utilities/api.js', () => ({ requests: { get: mocks.get, post: mocks.post } }))

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
let auth: ReturnType<typeof useAuth>

function Consumer() {
  auth = useAuth()
  return null
}

beforeEach(() => {
  if (typeof process === 'undefined') {
    vi.stubGlobal('process', { env: { NEXT_BASE_PATH: '', NEXT_TRAILING_SLASH: 'false' } })
  }

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({ status: 200, json: async () => ({ user: null }) })
  mocks.post.mockResolvedValue({ status: 200 })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('logout collection reconciliation', () => {
  it('should revoke the public session after the admin me endpoint clears the client user, before navigating', async () => {
    let finishLogout!: () => void
    mocks.post.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishLogout = resolve
        }),
    )

    await act(() =>
      root.render(
        <AuthProvider user={null}>
          <Consumer />
          <LogoutClient
            adminRoute="/admin"
            redirect=""
            user={{ id: 'public-user', collection: 'public-users' }}
          />
        </AuthProvider>,
      ),
    )

    expect(auth.user).toBeNull()
    expect(mocks.get).toHaveBeenCalledWith('/api/users/me', expect.any(Object))
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/api/public-users/logout')
    expect(mocks.router.push).not.toHaveBeenCalled()

    await act(() => finishLogout())

    expect(mocks.router.push).toHaveBeenCalledExactlyOnceWith('/admin/login')
  })

  it('should preserve no-argument logout and prefer the current session over a stale fallback', async () => {
    const user = { id: 'admin', collection: 'users' } as AuthenticatedUser
    mocks.get.mockResolvedValue({ status: 200, json: async () => ({ user }) })

    await act(() =>
      root.render(
        <AuthProvider user={user}>
          <Consumer />
        </AuthProvider>,
      ),
    )
    await act(() => auth.logOut())

    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/api/users/logout')
    expect(auth.user).toBeNull()

    await act(() => auth.setUser({ exp: 0, user }))
    mocks.post.mockClear()
    await act(() => auth.logOut({ collection: 'public-users' }))

    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/api/users/logout')
  })
})
