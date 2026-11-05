import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetaTitleComponent } from './MetaTitle/MetaTitleComponent.js'
import { MetaDescriptionComponent } from './MetaDescription/MetaDescriptionComponent.js'

const mocks = vi.hoisted(() => ({ setValue: vi.fn(), error: vi.fn() }))
const config = { routes: { api: '/api' } }
function noop() {}
vi.mock('@payloadcms/ui', () => ({
  FieldLabel: () => null,
  TextInput: () => null,
  TextareaInput: () => null,
  useConfig: () => ({ config }),
  useDocumentInfo: () => ({}),
  useDocumentTitle: () => ({}),
  useField: () => ({ value: 'Existing text', setValue: mocks.setValue }),
  useForm: () => ({ getData: () => ({}) }),
  useLocale: () => undefined,
  useTranslation: () => ({ t: (key: string) => key }),
  toast: { error: mocks.error },
}))
vi.mock('@payloadcms/ui/shared', () => ({
  reduceToSerializableFields: (fields: unknown) => fields,
}))
vi.mock('../ui/LengthIndicator.js', () => ({ LengthIndicator: () => null }))
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  if (typeof process === 'undefined') vi.stubGlobal('process', { env: {} })
  mocks.setValue.mockClear()
  mocks.error.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('SEO generation lifecycle (#17239)', () => {
  for (const kind of ['title', 'description'] as const) {
    const render = (readOnly = false) =>
      kind === 'title' ? (
        <MetaTitleComponent
          field={{ type: 'text' } as never}
          hasGenerateTitleFn
          readOnly={readOnly}
        />
      ) : (
        <MetaDescriptionComponent
          field={{ type: 'textarea' } as never}
          hasGenerateDescriptionFn
          readOnly={readOnly}
        />
      )
    it(`should show pending ${kind} generation and prevent duplicate/read-only requests`, async () => {
      let resolve!: (value: Response) => void
      const fetch = vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done
          }),
      )
      vi.stubGlobal('fetch', fetch)
      await act(() => root.render(render()))
      const button = container.querySelector('button')!
      await act(() => button.click())
      expect(button.disabled).toBe(true)
      expect(button.getAttribute('aria-busy')).toBe('true')
      expect(container.querySelector('[role="status"]')?.textContent).toContain('general:loading')
      await act(() => button.click())
      expect(fetch).toHaveBeenCalledOnce()
      await act(() => resolve(Response.json({ result: 'Generated text' })))
      expect(button.disabled).toBe(false)
      expect(mocks.setValue).toHaveBeenCalledWith('Generated text')
      await act(() => root.render(render(true)))
      await act(() => container.querySelector('button')!.click())
      expect(fetch).toHaveBeenCalledOnce()
    })
    it(`should recover ${kind} generation after an HTTP failure without clearing existing text`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json({ error: 'Failed' }, { status: 500 })),
      )
      await act(() => root.render(render()))
      await act(() => container.querySelector('button')!.click())
      expect(container.querySelector('button')!.disabled).toBe(false)
      expect(mocks.setValue).not.toHaveBeenCalled()
      expect(mocks.error).toHaveBeenCalled()
    })
  }
})
