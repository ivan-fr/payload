import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { OrderableTable } from './OrderableTable.js'

const mocks = vi.hoisted(() => ({
  drag: undefined as any,
  error: vi.fn(),
  config: { routes: { api: '/api' } },
  query: { sort: '_order' },
}))
vi.mock('../../providers/Config/index.js', () => ({ useConfig: () => ({ config: mocks.config }) }))
vi.mock('../../providers/ListQuery/index.js', () => ({
  useListQuery: () => ({ query: mocks.query, orderableFieldName: '_order' }),
}))
vi.mock('../../providers/Locale/index.js', () => ({ useLocale: () => ({ code: 'en' }) }))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('./TableIdentity.js', () => ({ useTableID: () => 'table' }))
vi.mock('../DraggableSortable/index.js', () => ({
  DraggableSortable: (props: any) => {
    mocks.drag = props
    return props.children
  },
}))
vi.mock('../DraggableSortable/DraggableSortableItem/index.js', () => ({
  DraggableSortableItem: () => null,
}))
vi.mock('./OrderableRow.js', () => ({ OrderableRow: () => null }))
vi.mock('./OrderableRowDragPreview.js', () => ({ OrderableRowDragPreview: () => null }))
vi.mock('@dnd-kit/core', () => ({ DragOverlay: () => null }))
vi.mock('sonner', () => ({ toast: { error: mocks.error, warning: vi.fn() } }))
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('process', { env: {} })
  mocks.error.mockClear()
})
afterEach(() => vi.unstubAllGlobals())
it.each([400, 403])(
  'should show the server rejection and restore row order (%s) (#16308)',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { errors: [{ message: 'Reordering is not allowed for this page', isPublic: true }] },
          { status },
        ),
      ),
    )
    const rows = [
      { id: 1, _order: 'a' },
      { id: 2, _order: 'b' },
    ]
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(() =>
        root.render(
          <OrderableTable
            collection={{ slug: 'pages' } as never}
            columns={[{ accessor: 'title', active: true, Heading: 'Title' } as never]}
            data={rows}
          />,
        ),
      )
      await act(() => mocks.drag.onDragEnd({ moveFromIndex: 0, moveToIndex: 1 }))
      expect(mocks.error).toHaveBeenCalledExactlyOnceWith('Reordering is not allowed for this page')
      expect(mocks.drag.ids).toEqual([1, 2])
      expect(rows.map(({ _order }) => _order)).toEqual(['a', 'b'])
    } finally {
      await act(() => root.unmount())
    }
  },
)
