import type { PopupButtonRenderProps } from './index.js'

import { describe, expect, it, vi } from 'vitest'

import { PopupTrigger } from './index.js'

describe('custom popup trigger disabled contract', () => {
  it.each([false, true])(
    'should forward disabled state to renderButton and guard activation (disabled: %s)',
    (disabled) => {
      let received: PopupButtonRenderProps | undefined
      const setActive = vi.fn()
      PopupTrigger({
        active: false,
        buttonType: 'default',
        contentId: 'submenu',
        disabled,
        isMenuItem: true,
        popupType: 'menu',
        setActive,
        renderButton: (props) => {
          received = props
          return null
        },
      })
      expect(received).toMatchObject({
        disabled,
        'aria-disabled': disabled,
        role: 'menuitem',
        'aria-controls': 'submenu',
      })
      const preventDefault = vi.fn()
      received!.onClick({ preventDefault } as never)
      if (disabled) {
        expect(preventDefault).toHaveBeenCalledOnce()
        expect(setActive).not.toHaveBeenCalled()
      } else expect(setActive).toHaveBeenCalledWith(true, false)
    },
  )
})
