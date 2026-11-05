import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TabsField } from './index.js'

const state = {
  'layout.0.extra': { passesCondition: false },
  'layout.1.extra': { passesCondition: true },
}
const tabs = [
  { label: 'Main', fields: [] },
  { name: 'extra', id: '_index-0.extra', label: 'Extra', fields: [] },
]
const preferences = { getPreference: async () => ({}), setPreference: async () => {} }
vi.mock('../../forms/Form/index.js', () => ({
  useFormFields: (selector: Function) => selector([state]),
}))
vi.mock('../../forms/useField/index.js', () => ({ useField: () => ({}) }))
vi.mock('../../forms/withCondition/index.js', () => ({
  withCondition: (component: unknown) => component,
}))
vi.mock('../../providers/DocumentInfo/index.js', () => ({ useDocumentInfo: () => ({}) }))
vi.mock('../../providers/Preferences/index.js', () => ({ usePreferences: () => preferences }))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}))
vi.mock('../../elements/Collapsible/provider.js', () => ({ useCollapsible: () => ({}) }))
vi.mock('../../elements/RenderCustomComponent/index.js', () => ({
  RenderCustomComponent: () => null,
}))
vi.mock('../../forms/RenderFields/index.js', () => ({ RenderFields: () => null }))
vi.mock('../FieldDescription/index.js', () => ({ FieldDescription: () => null }))
vi.mock('./Tab/index.js', () => ({
  TabComponent: ({ hidden, tab }: any) => (
    <button hidden={hidden} type="button">
      {tab.label}
    </button>
  ),
}))
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('conditional tab visibility in repeated rows (#18452)', () => {
  it('should read each row visibility from its runtime data path', async () => {
    await act(() =>
      root.render(
        <>
          {[0, 1].map((row) => (
            <section key={row}>
              <TabsField
                field={{ type: 'tabs', tabs } as never}
                path={`layout.${row}._index-0`}
                schemaPath="pages.layout.section._index-0"
                indexPath="0"
              />
            </section>
          ))}
        </>,
      ),
    )
    const sections = container.querySelectorAll('section')

    expect(sections[0]!.querySelectorAll('button')[1]!.hidden).toBe(true)
    expect(sections[1]!.querySelectorAll('button')[1]!.hidden).toBe(false)
  })
})
