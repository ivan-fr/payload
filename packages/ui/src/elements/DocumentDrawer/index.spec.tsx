import { ModalProvider, useModal } from '@faceless-ui/modal'
import { useEffect } from 'react'
import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'

vi.mock('../Drawer/index.js', () => ({ Drawer: () => null, DrawerToggler: () => null }))
vi.mock('./DrawerContent.js', () => ({ DocumentDrawerContent: () => null }))

import { useDocumentDrawer } from './index.js'

function Fixture({ onDrawerMount }: { onDrawerMount: () => void }) {
  const [Drawer, , { closeDrawer, isDrawerOpen, openDrawer }] = useDocumentDrawer({
    collectionSlug: 'posts',
    id: 1,
    drawerSlug: 'document-drawer',
  })
  const { openModal, closeModal } = useModal()
  useEffect(onDrawerMount, [Drawer, onDrawerMount])

  return (
    <>
      <button onClick={openDrawer} type="button">
        Open document
      </button>
      <button onClick={closeDrawer} type="button">
        Close document
      </button>
      <button onClick={() => openModal('other')} type="button">
        Open other
      </button>
      <button onClick={() => closeModal('other')} type="button">
        Close other
      </button>
      <output>{isDrawerOpen ? 'open' : 'closed'}</output>
    </>
  )
}

test('should report close and reopen while preserving drawer component identity across modal updates', async () => {
  const mounted = vi.fn()
  const screen = await render(
    <ModalProvider transTime={0}>
      <Fixture onDrawerMount={mounted} />
    </ModalProvider>,
  )

  await expect.element(screen.getByRole('status')).toHaveTextContent('closed')
  await screen.getByRole('button', { name: 'Open document' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent('open')
  await screen.getByRole('button', { name: 'Close document' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent('closed')
  await screen.getByRole('button', { name: 'Open document' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent('open')
  await screen.getByRole('button', { name: 'Open other' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent('open')
  await screen.getByRole('button', { name: 'Close other' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent('open')
  expect(mounted).toHaveBeenCalledOnce()
})
