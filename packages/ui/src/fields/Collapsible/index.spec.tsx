import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RenderIfInViewport } from '../../elements/RenderIfInViewport/index.js'
import { CollapsibleField } from './index.js'

const preferences = { getPreference: async () => ({}), setPreference: async () => {} }
vi.mock('../../providers/Preferences/index.js', () => ({ usePreferences: () => preferences }))
vi.mock('../../providers/DocumentInfo/index.js', () => ({ useDocumentInfo: () => ({}) }))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}))
vi.mock('../../forms/useField/index.js', () => ({ useField: () => ({}) }))
vi.mock('../../forms/withCondition/index.js', () => ({
  withCondition: (component: unknown) => component,
}))
vi.mock('../../forms/WatchChildErrors/index.js', () => ({ WatchChildErrors: () => null }))
vi.mock('../../elements/Collapsible/index.js', () => ({
  Collapsible: ({ children }: any) => children,
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
describe('collapsible force rendering (#17473)', () => {
  for (const forceRender of [true, false]) {
    it(`should honor forceRender=${forceRender} when no intersection event is delivered`, async () => {
      await act(() =>
        root.render(
          <CollapsibleField
            field={{ type: 'collapsible', label: 'Details', fields: [] }}
            path="_index-0"
            parentPath=""
            parentSchemaPath="pages"
            forceRender={forceRender}
          />,
        ),
      )
      expect(Boolean(container.querySelector('input'))).toBe(forceRender)
    })
  }
})
