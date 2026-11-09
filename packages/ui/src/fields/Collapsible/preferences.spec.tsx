import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RenderIfInViewport } from '../../elements/RenderIfInViewport/index.js'
import { CollapsibleField } from './index.js'

const preferences = {
  getPreference: vi.fn(async () => ({ fields: { '_index-0': { collapsed: true } } })),
  setPreference: vi.fn(async () => {}),
}
const captured = { current: undefined as any }
vi.mock('../../providers/Preferences/index.js', () => ({ usePreferences: () => preferences }))
vi.mock('../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ preferencesKey: 'collection-pages-1' }),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}))
vi.mock('../../forms/useField/index.js', () => ({ useField: () => ({}) }))
vi.mock('../../forms/withCondition/index.js', () => ({
  withCondition: (component: unknown) => component,
}))
vi.mock('../../forms/WatchChildErrors/index.js', () => ({ WatchChildErrors: () => null }))
vi.mock('../../elements/Collapsible/index.js', () => ({
  Collapsible: (props: any) => {
    captured.current = props
    return props.children
  },
}))
vi.mock('../../elements/ErrorPill/index.js', () => ({ ErrorPill: () => null }))
vi.mock('../../elements/RenderCustomComponent/index.js', () => ({
  RenderCustomComponent: () => null,
}))
vi.mock('../../forms/RowLabel/index.js', () => ({ RowLabel: () => null }))
vi.mock('../../fields/FieldDescription/index.js', () => ({ FieldDescription: () => null }))
vi.mock('../../forms/RenderFields/index.js', () => ({
  RenderFields: ({ forceRender }: any) => (
    <RenderIfInViewport forceRender={forceRender}>
      <input aria-label="Nested field" />
    </RenderIfInViewport>
  ),
}))
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(() => {
  preferences.getPreference.mockClear()
  preferences.setPreference.mockClear()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
describe('collapsible preference opt-out (#16952)', () => {
  it.each([false, true])(
    'should honor initCollapsed=%s without reading or writing saved preferences',
    async (initCollapsed) => {
      await act(() =>
        root.render(
          <CollapsibleField
            field={{
              type: 'collapsible',
              label: 'Details',
              fields: [],
              admin: { initCollapsed, persistCollapsedState: false },
            }}
            path="_index-0"
            parentPath=""
            parentSchemaPath="pages"
          />,
        ),
      )
      expect(captured.current.initCollapsed).toBe(initCollapsed)
      expect(preferences.getPreference).not.toHaveBeenCalled()
      await act(() => captured.current.onToggle(!initCollapsed))
      expect(preferences.setPreference).not.toHaveBeenCalled()
    },
  )
  it('should retain the existing persisted-state behavior by default', async () => {
    await act(async () =>
      root.render(
        <CollapsibleField
          field={{
            type: 'collapsible',
            label: 'Details',
            fields: [],
            admin: { initCollapsed: false },
          }}
          path="_index-0"
          parentPath=""
          parentSchemaPath="pages"
        />,
      ),
    )
    expect(captured.current.initCollapsed).toBe(true)
    await act(() => captured.current.onToggle(false))
    expect(preferences.setPreference).toHaveBeenCalledWith('collection-pages-1', {
      fields: { '_index-0': { collapsed: false } },
    })
  })
})
