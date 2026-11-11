import { ModalContainer, ModalProvider } from '@faceless-ui/modal'
import { page, userEvent } from 'vitest/browser'
import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { ModalFocusProvider } from '../../providers/ModalFocus/index.js'
import { Drawer, DrawerToggler } from './index.js'
import '../../css/app.css'

vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ t: () => 'Close' }),
}))

it.each([320, 400, 1440])(
  'should scroll inside the drawer and keep its footer visible at %spx (#19403)',
  async (width) => {
    await page.viewport(width, 720)

    const screen = await render(
      <ModalProvider classPrefix="payload" transTime={0}>
        <ModalFocusProvider>
          <DrawerToggler slug="long-drawer">Open long drawer</DrawerToggler>
          <Drawer slug="long-drawer" title="Long drawer">
            <div style={{ flex: '0 0 auto', height: 1600 }}>Long content</div>
            <footer
              style={{ background: 'white', bottom: 0, flex: '0 0 auto', position: 'sticky' }}
            >
              <button type="button">Confirm</button>
            </footer>
          </Drawer>
          <ModalContainer />
        </ModalFocusProvider>
      </ModalProvider>,
    )
    const opener = screen.getByRole('button', { name: 'Open long drawer' })

    await opener.click()

    const dialog = screen.getByRole('dialog', { name: 'Long drawer' })

    await expect.element(dialog).toBeVisible()
    const panel = dialog.element().querySelector<HTMLElement>('.drawer__content-children')!
    const footer = screen.getByRole('button', { name: 'Confirm' }).element()

    expect(Math.abs(dialog.element().getBoundingClientRect().height - 720)).toBeLessThan(2)
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight)
    expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(720)
    panel.scrollTop = 400
    expect(panel.scrollTop).toBe(400)
    expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(720)

    await expect.element(screen.getByRole('heading', { name: 'Long drawer' })).toHaveFocus()
    await userEvent.tab()
    await expect.element(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
    await userEvent.tab()
    await expect.element(screen.getByRole('button', { name: 'Close', exact: true })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect.element(opener).toHaveFocus()
  },
)
