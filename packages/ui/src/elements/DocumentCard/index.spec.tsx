import type { LinkAdapterProps, RouterAdapterRouter } from 'payload'
import type { ReactNode } from 'react'

import { expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { RouterAdapterContext } from '../../providers/RouterAdapter/index.js'
import { DocumentCard } from './index.js'

test('should use the href as a full-card link when selection is unavailable', async () => {
  const push = vi.fn()
  const router: RouterAdapterRouter = {
    back: vi.fn(),
    push,
    refresh: vi.fn(),
    replace: vi.fn(),
  }
  const TestLink = ({ href, ...props }: LinkAdapterProps) => <a href={href} {...props} />

  const screen = await render(
    <RouterAdapterContext
      value={{
        Link: TestLink,
        params: {},
        pathname: '/',
        router,
        searchParams: new URLSearchParams(),
      }}
    >
      <DocumentCard href="/documents/1" placeholder="Preview" title="Example document" />
    </RouterAdapterContext>,
  )

  const cardElement = document.querySelector<HTMLElement>('.document-card')
  const card = page.elementLocator(cardElement!)
  const link = screen.getByRole('link', { name: 'Example document' })

  await expect.element(link).toHaveAttribute('href', '/documents/1')
  await expect.element(card).not.toHaveAttribute('role')
  await card.click({ position: { x: 10, y: 10 } })
  expect(push).toHaveBeenCalledWith('/documents/1', { scroll: undefined })
})

test('should keep nested actions interactive on an href-only card', async () => {
  const edit = vi.fn()
  const push = vi.fn()
  const router: RouterAdapterRouter = {
    back: vi.fn(),
    push,
    refresh: vi.fn(),
    replace: vi.fn(),
  }
  const TestLink = ({ href, ...props }: LinkAdapterProps) => <a href={href} {...props} />

  const screen = await render(
    <RouterAdapterContext
      value={{
        Link: TestLink,
        params: {},
        pathname: '/',
        router,
        searchParams: new URLSearchParams(),
      }}
    >
      <DocumentCard href="/documents/1" placeholder="Preview" title="Example document">
        <button onClick={edit} type="button">
          Edit
        </button>
      </DocumentCard>
    </RouterAdapterContext>,
  )

  await screen.getByRole('button', { name: 'Edit' }).click()
  expect(edit).toHaveBeenCalledOnce()
  expect(push).not.toHaveBeenCalled()
})

test('should keep selection available without navigating when the href is null', async () => {
  const onSelect = vi.fn()
  const push = vi.fn()
  const TestLink = ({ href, ...props }: LinkAdapterProps) => <a href={href} {...props} />

  const screen = await render(
    <RouterAdapterContext
      value={{
        Link: TestLink,
        params: {},
        pathname: '/',
        router: { back: vi.fn(), push, refresh: vi.fn(), replace: vi.fn() },
        searchParams: new URLSearchParams(),
      }}
    >
      <DocumentCard href={null} onSelect={onSelect} title="Example document" />
    </RouterAdapterContext>,
  )
  const card = screen.getByRole('button', { name: 'Example document' })

  expect(document.querySelector('.document-card a')).toBeNull()
  await card.click()
  expect(onSelect).toHaveBeenCalledOnce()
  await userEvent.keyboard('{Enter}')
  expect(onSelect).toHaveBeenCalledTimes(2)
  await userEvent.keyboard(' ')
  expect(onSelect).toHaveBeenCalledTimes(3)
  await card.dblClick()
  expect(push).not.toHaveBeenCalled()
})

test('should replace a failed thumbnail and retry when its source changes (#19181)', async () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <RouterAdapterContext
      value={{
        Link: ({ href, ...props }: LinkAdapterProps) => <a href={href} {...props} />,
        params: {},
        pathname: '/',
        searchParams: new URLSearchParams(),
        router: { back: vi.fn(), push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
      }}
    >
      {children}
    </RouterAdapterContext>
  )
  const screen = await render(
    <Wrapper>
      <DocumentCard
        title="Failed image"
        thumbnail={{ src: 'data:image/png;base64,broken' }}
        placeholder="File preview"
      />
    </Wrapper>,
  )
  await expect.element(screen.getByText('File preview')).toBeVisible()
  await expect.element(screen.getByText('Failed image')).toBeVisible()
  const valid = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  await screen.rerender(
    <Wrapper>
      <DocumentCard title="Valid image" thumbnail={{ src: valid }} placeholder="File preview" />
    </Wrapper>,
  )
  const image = document.querySelector<HTMLImageElement>('.document-card__thumbnail')!
  await expect.poll(() => image.naturalWidth).toBe(1)
  await expect.element(screen.getByText('File preview')).not.toBeInTheDocument()
})
