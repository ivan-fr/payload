import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  effects: [] as (() => unknown)[],
  register: vi.fn().mockReturnValue(() => {}),
  requestOpen: vi.fn(),
  enabled: undefined as boolean | undefined,
  setActive: undefined as ((active: boolean) => void) | undefined,
}))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    use: () => ({
      popupRole: 'menu',
      popupRef: { current: null },
      submenuScope: {
        register: fixture.register,
        requestOpen: fixture.requestOpen,
        release: vi.fn(),
      },
    }),
    useEffect: (effect: () => unknown) => fixture.effects.push(effect),
  }
})
vi.mock('../../hooks/useEffectEvent.js', () => ({
  useEffectEvent: (callback: unknown) => callback,
}))
vi.mock('../../providers/ModalFocus/index.js', () => ({
  useModalFocus: () => ({ registerPopup: vi.fn() }),
}))
vi.mock('../../providers/Theme/index.js', () => ({ ThemeProvider: () => null }))
vi.mock('./PopupTrigger/index.js', () => ({
  PopupTrigger: ({ setActive }: { setActive: (active: boolean) => void }) => {
    fixture.setActive = setActive
    return null
  },
}))
vi.mock('./useSubmenuPointerIntent.js', () => ({
  useSubmenuPointerIntent: ({ enabled }: { enabled: boolean }) => {
    fixture.enabled = enabled
    return { triggerProps: {}, contentProps: {}, isProtected: () => false, updateSafeArea: vi.fn() }
  },
}))

import { Popup } from './index.js'

describe('disabled submenu activation (#19072)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fixture.effects = []
  })
  it('should disable pointer intent, omit parent registration, and reject activation', () => {
    const onToggleOpen = vi.fn()
    renderToStaticMarkup(
      createElement(Popup, { disabled: true, hoverSubmenu: true, popupType: 'menu', onToggleOpen }),
    )
    fixture.effects.forEach((effect) => effect())
    expect(fixture.enabled).toBe(false)
    expect(fixture.register).not.toHaveBeenCalled()
    fixture.setActive!(true)
    expect(fixture.requestOpen).not.toHaveBeenCalled()
    expect(onToggleOpen).not.toHaveBeenCalled()
  })
  it('should retain parent coordination and pointer intent for enabled submenus', () => {
    renderToStaticMarkup(createElement(Popup, { hoverSubmenu: true, popupType: 'menu' }))
    fixture.effects.forEach((effect) => effect())
    expect(fixture.enabled).toBe(true)
    expect(fixture.register).toHaveBeenCalledOnce()
    fixture.setActive!(true)
    expect(fixture.requestOpen).toHaveBeenCalledOnce()
  })
})
