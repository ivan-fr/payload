import type { FormState } from 'payload'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { DrawerContent } from './DrawerContent.js'

const mocks = vi.hoisted(() => ({
  form: undefined as any,
  getFormState: vi.fn(),
  doc: { id: 1, collectionSlug: 'posts', getDocPreferences: async () => ({}) },
  fields: {},
  config: { fieldProps: { featureClientSchemaMap: {} } },
}))
vi.mock('@lexical/react/useLexicalEditable', () => ({ useLexicalEditable: () => true }))
vi.mock('@payloadcms/ui', () => ({
  Form: (props: any) => {
    mocks.form = props
    return null
  },
  RenderFields: () => null,
  useDocumentForm: () => ({ fields: mocks.fields }),
  useDocumentInfo: () => mocks.doc,
  useServerFunctions: () => ({ getFormState: mocks.getFormState }),
  useEffectEvent: (callback: unknown) => callback,
}))
vi.mock('../../lexical/config/client/EditorConfigProvider.js', () => ({
  useEditorConfigContext: () => mocks.config,
}))
vi.mock('./useDrawerSubmit.js', () => ({ RegisterFormSubmit: () => null }))

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.getFormState.mockReset().mockResolvedValue({ state: {} })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() =>
    root.render(
      <DrawerContent
        featureKey="link"
        schemaPath="content"
        submitRef={{ current: null }}
        handleDrawerSubmit={vi.fn()}
      />,
    ),
  )
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('should keep submit validation alive while debounced changes replace each other and cancel both channels on unmount', async () => {
  const requests: Array<{
    signal: AbortSignal
    resolve: (result: { state: FormState | null }) => void
  }> = []
  mocks.getFormState.mockImplementation(
    ({ signal }: { signal: AbortSignal }) =>
      new Promise((resolve) => {
        requests.push({ signal, resolve })
        signal.addEventListener('abort', () => resolve({ state: null }))
      }),
  )
  const previous = { url: { value: 'https://example.com', valid: false } }
  const validated = { url: { value: 'https://example.com', valid: true } }
  const submit = mocks.form.beforeSubmit[0]({ formState: previous })
  await act(async () => {})
  const firstChange = mocks.form.onChange[0]({ formState: previous })
  await act(async () => {})
  const secondChange = mocks.form.onChange[0]({ formState: previous })
  await act(async () => {})

  expect(requests).toHaveLength(3)
  expect(requests[0].signal.aborted).toBe(false)
  expect(requests[1].signal.aborted).toBe(true)
  requests[0].resolve({ state: validated })
  expect(await submit).toEqual(validated)
  await firstChange

  const nextSubmit = mocks.form.beforeSubmit[0]({ formState: previous })
  await act(async () => {})
  await act(() => root.render(null))
  expect(requests[2].signal.aborted).toBe(true)
  expect(requests[3].signal.aborted).toBe(true)
  await Promise.all([secondChange, nextSubmit])
})
