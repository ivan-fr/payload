import type { RouterAdapterContextValue } from '../../../../providers/RouterAdapter/index.js'

import { userEvent } from 'vitest/browser'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { RouterAdapterContext } from '../../../../providers/RouterAdapter/index.js'
import { DocumentTabLink } from './TabLink.js'
import './index.css'
import '../index.css'
import '../../../../css/app.css'

const router: RouterAdapterContextValue = {
  Link: ({ href, prefetch: _prefetch, ...props }) => <a {...props} href={href} />,
  params: { segments: ['collections', 'posts', '1'] },
  pathname: '/admin/collections/posts/1',
  router: {} as RouterAdapterContextValue['router'],
  searchParams: new URLSearchParams('locale=fr'),
}

beforeEach(() => vi.stubGlobal('process', { env: {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-enhanced-contrast')
  document.documentElement.removeAttribute('data-theme')
})

it.each([
  { order: 'button-last', theme: 'light' },
  { order: 'tab-last', theme: 'light' },
  { order: 'button-last', theme: 'dark' },
  { order: 'tab-last', theme: 'dark' },
])(
  'should retain inactive tab colors in either stylesheet order: $order ($theme) (#19406)',
  async ({ order, theme }) => {
    document.documentElement.dataset.theme = theme
    const screen = await render(
      <RouterAdapterContext value={router}>
        <div>
          <span data-testid="primary" style={{ color: 'var(--color-text)' }} />
          <span data-testid="secondary" style={{ color: 'var(--color-text-secondary)' }} />
          <nav aria-label="Document views" className="doc-tabs">
            <div className="doc-tabs__tabs-container">
              <ul className="doc-tabs__tabs">
                <li>
                  <DocumentTabLink adminRoute="/admin" baseClass="doc-tab" href="">
                    Edit
                  </DocumentTabLink>
                </li>
                <li>
                  <DocumentTabLink adminRoute="/admin" baseClass="doc-tab" href="/versions">
                    Versions
                  </DocumentTabLink>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </RouterAdapterContext>,
    )
    const suffix = order === 'button-last' ? '/Button/index.css' : '/Tab/index.css'
    const stylesheet = [
      ...document.querySelectorAll<HTMLStyleElement>('style[data-vite-dev-id]'),
    ].find((style) => style.dataset.viteDevId?.endsWith(suffix))!

    expect(stylesheet).toBeDefined()
    document.head.append(stylesheet)

    const inactive = screen.getByRole('link', { name: 'Versions' })
    const active = screen.getByRole('link', { name: 'Edit', exact: true })

    for (const enhanced of [false, true]) {
      document.documentElement.toggleAttribute('data-enhanced-contrast', enhanced)
      await userEvent.hover(document.body)
      expect(getComputedStyle(inactive.element()).color).toBe(
        getComputedStyle(screen.getByTestId('secondary').element()).color,
      )
      expect(getComputedStyle(active.element()).color).toBe(
        getComputedStyle(screen.getByTestId('primary').element()).color,
      )
      expect(active.element().getAttribute('aria-current')).toBe('page')
      expect(inactive.element().getAttribute('href')).toBe(
        '/admin/collections/posts/1/versions?locale=fr',
      )
      await inactive.hover()
      expect(getComputedStyle(inactive.element()).color).toBe(
        getComputedStyle(screen.getByTestId('primary').element()).color,
      )
    }

    await userEvent.tab()
    await expect.element(active).toHaveFocus()
    await userEvent.tab()
    await expect.element(inactive).toHaveFocus()
  },
)
