import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

import { UserMenu } from './index.js'

vi.mock('@faceless-ui/window-info', () => ({
  useWindowInfo: () => ({ breakpoints: { s: false } }),
}))
vi.mock('../../providers/Auth/index.js', () => ({
  useAuth: () => ({ user: { email: 'admin@example.com' } }),
}))
vi.mock('../../providers/Config/index.js', () => ({
  useConfig: () => ({
    config: {
      admin: { routes: { account: '/profile', logout: '/logout' }, user: 'users' },
      routes: { admin: '/manage' },
    },
    getEntityConfig: () => ({ admin: {} }),
  }),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ t: (key: string) => key, languageOptions: [] }),
}))
vi.mock('../Popup/index.js', () => ({
  Popup: ({ children }: any) => children,
  PopupList: { MenuItem: ({ children }: any) => children, Button: () => null },
}))
vi.mock('../RenderCustomComponent/index.js', () => ({ RenderCustomComponent: () => null }))
vi.mock('./LanguageMenu/index.js', () => ({
  LanguageMenu: () => null,
  LanguageMenuContent: () => null,
}))
vi.mock('./ThemeMenu/index.js', () => ({ ThemeMenu: () => null, ThemeMenuContent: () => null }))
vi.mock('./SettingsMenu/index.js', () => ({
  SettingsMenu: () => null,
  SettingsMenuContent: () => null,
}))
vi.mock('./SubMenuHeader/index.js', () => ({ SubMenuHeader: () => null }))

afterEach(() => vi.unstubAllGlobals())

it.each(['', '/cms'])(
  'should keep the profile anchor inside the application base path (%s)',
  async (basePath) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('process', { env: { NEXT_BASE_PATH: basePath, NEXT_TRAILING_SLASH: 'false' } })
    const container = document.createElement('div')
    const root = createRoot(container)
    try {
      await act(() => root.render(<UserMenu />))
      const profile = container.querySelector('a[role="menuitem"]')
      expect(profile?.getAttribute('href')).toBe(`${basePath}/manage/profile`)
      expect(profile?.getAttribute('aria-label')).toContain('admin@example.com')
    } finally {
      await act(() => root.unmount())
    }
  },
)
