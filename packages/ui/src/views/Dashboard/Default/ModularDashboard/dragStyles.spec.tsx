import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

import { ModularDashboardClient } from './index.client.js'

const mocks = vi.hoisted(() => ({ dnd: undefined as any, layout: [] }))
vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: any) => {
    mocks.dnd = props
    return props.children
  },
  DragOverlay: () => null,
  useDraggable: () => ({}),
  useDroppable: () => ({}),
}))
vi.mock('@dnd-kit/modifiers', () => ({ snapCenterToCursor: vi.fn() }))
vi.mock('../../../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: {}, t: (key: string) => key }),
}))
vi.mock('./useDashboardLayout.js', () => ({
  useDashboardLayout: () => ({ currentLayout: mocks.layout, isEditing: true, moveWidget: vi.fn() }),
}))
vi.mock('./utils/sensors.js', () => ({ useDashboardSensors: () => [] }))
vi.mock('./utils/collisionDetection.js', () => ({ closestInXAxis: vi.fn() }))
vi.mock('./DashboardStepNav.js', () => ({ DashboardStepNav: () => null }))
vi.mock('./WidgetContent/index.js', () => ({ WidgetContent: () => null }))
vi.mock('./WidgetEditControl.js', () => ({ WidgetEditControl: () => null }))
vi.mock('./WidgetMoveControl/index.js', () => ({ WidgetMoveControl: () => null }))
vi.mock('../../../../elements/Popup/index.js', () => ({ Popup: () => null }))
vi.mock('../../../../elements/Popup/PopupButtonList/index.js', () => ({}))

afterEach(() => {
  document.body.classList.remove('is-dragging')
  vi.unstubAllGlobals()
})

it('should scope drag cursor lifetime to a dashboard drag, including cancellation and unmount', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(() => root.render(<ModularDashboardClient clientLayout={[]} widgets={[]} />))
    expect(document.body.classList.contains('is-dragging')).toBe(false)
    await act(() => mocks.dnd.onDragStart({ active: { id: 'widget-1' } }))
    expect(document.body.classList.contains('is-dragging')).toBe(true)
    await act(() => mocks.dnd.onDragCancel())
    expect(document.body.classList.contains('is-dragging')).toBe(false)
    await act(() => mocks.dnd.onDragStart({ active: { id: 'widget-1' } }))
    await act(() => mocks.dnd.onDragEnd({ over: null }))
    expect(document.body.classList.contains('is-dragging')).toBe(false)
    await act(() => mocks.dnd.onDragStart({ active: { id: 'widget-1' } }))
  } finally {
    await act(() => root.unmount())
  }
  expect(document.body.classList.contains('is-dragging')).toBe(false)
})
