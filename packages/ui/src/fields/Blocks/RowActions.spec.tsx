import type { ClientBlock } from 'payload'
import type { ComponentProps, ReactNode } from 'react'
import type { Root } from 'react-dom/client'

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  i18n: { language: 'en' },
  blocksMap: {},
  closeModal: vi.fn(),
  openModal: vi.fn(),
}))
vi.mock('@faceless-ui/modal', () => ({
  useModal: () => ({
    closeModal: fixture.closeModal,
    openModal: fixture.openModal,
    isModalOpen: () => true,
  }),
}))
vi.mock('../../elements/Drawer/useDrawerSlug.js', () => ({ useDrawerSlug: () => 'blocks' }))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: fixture.i18n, t: (key: string) => key }),
}))
vi.mock('../../providers/Config/index.js', () => ({
  useConfig: () => ({ config: { blocksMap: fixture.blocksMap } }),
}))
vi.mock('../../elements/Drawer/index.js', () => ({
  Drawer: ({
    children,
    headerActions,
  }: {
    children: ReactNode
    headerActions: { label: string; disabled?: boolean; onClick: () => void }[]
  }) => (
    <div>
      {headerActions.map((action) => (
        <button
          disabled={action.disabled}
          key={action.label}
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      ))}
      {children}
    </div>
  ),
}))
vi.mock('./BlockSelector/BlockSearch/index.js', () => ({ BlockSearch: () => null }))
vi.mock('../../elements/ArrayAction/index.js', () => ({
  ArrayAction: ({ label, addRow }: { label: string; addRow: (index: number) => void }) => (
    <button onClick={() => addRow(1)} type="button">
      Add below {label}
    </button>
  ),
}))

import { RowActions } from './RowActions.js'

const allowed = {
  slug: 'text',
  labels: { singular: 'Text', plural: 'Texts' },
  fields: [],
} as ClientBlock
const existing = {
  slug: 'alert',
  labels: { singular: 'Alert', plural: 'Alerts' },
  fields: [],
} as ClientBlock
let container: HTMLDivElement
let root: Root
let addRow: ReturnType<typeof vi.fn>
const render = async ({ availableBlocks }: { availableBlocks?: ClientBlock[] } = {}) => {
  const props = {
    blocks: [allowed, existing],
    availableBlocks,
    blockType: 'alert',
    rowIndex: 0,
    labels: { singular: 'Block', plural: 'Blocks' },
    addRow,
  } as ComponentProps<typeof RowActions>
  await act(async () => root.render(<RowActions {...props} />))
}
const button = ({ title }: { title: string }) =>
  container.querySelector<HTMLButtonElement>(`button[title="${title}"]`)
const insert = () =>
  Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Insert')!

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  fixture.closeModal.mockClear()
  fixture.openModal.mockClear()
  addRow = vi.fn()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('filtered Add Below drawer (#15829)', () => {
  it('should insert an allowed block below an existing excluded block', async () => {
    await render({ availableBlocks: [allowed] })
    expect(button({ title: 'Text' })).not.toBeNull()
    expect(button({ title: 'Alert' })).toBeNull()
    expect(insert().disabled).toBe(true)
    const addBelow = Array.from(container.querySelectorAll('button')).find(
      (node) => node.textContent === 'Add below Alert 1',
    )!
    await act(async () => addBelow.click())
    expect(fixture.openModal).toHaveBeenCalledWith('blocks')
    await act(async () => button({ title: 'Text' })!.click())
    expect(button({ title: 'Text' })!.getAttribute('aria-pressed')).toBe('true')
    expect(insert().disabled).toBe(false)
    await act(async () => insert().click())
    expect(addRow).toHaveBeenCalledWith(1, 'text')
    expect(fixture.closeModal).toHaveBeenCalledWith('blocks')
  })
  it('should update available choices when the filter excludes every block', async () => {
    await render({ availableBlocks: [allowed] })
    await act(async () => button({ title: 'Text' })!.click())
    await render({ availableBlocks: [] })
    expect(container.querySelectorAll('.thumbnail-card')).toHaveLength(0)
    expect(insert().disabled).toBe(true)
    expect(addRow).not.toHaveBeenCalled()
  })
  it('should preserve both choices for consumers without a filter', async () => {
    await render()
    expect(button({ title: 'Text' })).not.toBeNull()
    expect(button({ title: 'Alert' })).not.toBeNull()
  })
})
