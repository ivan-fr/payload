import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const modal = vi.hoisted(() => ({
  modalState: {} as Record<string, { isOpen: boolean }>,
  openModal: vi.fn(),
  closeModal: vi.fn(),
  toggleModal: vi.fn(),
}))
vi.mock('@faceless-ui/modal', () => ({ useModal: () => modal }))
vi.mock('../Drawer/index.js', () => ({ Drawer: () => null, DrawerToggler: () => null }))
vi.mock('./DrawerContent.js', () => ({ DocumentDrawerContent: () => null }))

import { useDocumentDrawer } from './index.js'

const drawerSlug = 'document-drawer'
let state: ReturnType<typeof useDocumentDrawer>[2]
function Fixture() {
  ;[, , state] = useDocumentDrawer({ collectionSlug: 'posts', id: 1, drawerSlug })
  return createElement('output', null, String(state.isDrawerOpen))
}

describe('document drawer state (#19232)', () => {
  it('should report the actual drawer state through open, close and reopen', () => {
    for (const isOpen of [false, true, false, true]) {
      modal.modalState = { [drawerSlug]: { isOpen } }
      expect(renderToStaticMarkup(createElement(Fixture))).toBe(`<output>${isOpen}</output>`)
    }
    state.openDrawer()
    state.closeDrawer()
    state.toggleDrawer()
    expect(modal.openModal).toHaveBeenCalledWith(drawerSlug)
    expect(modal.closeModal).toHaveBeenCalledWith(drawerSlug)
    expect(modal.toggleModal).toHaveBeenCalledWith(drawerSlug)
  })

  it('should not report a different modal as this drawer being open', () => {
    modal.modalState = { other: { isOpen: true } }
    expect(renderToStaticMarkup(createElement(Fixture))).toBe('<output>false</output>')
  })
})
