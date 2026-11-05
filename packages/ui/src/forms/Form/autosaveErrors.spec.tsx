import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useForm, useFormSubmitted } from './context.js'
import { Form } from './index.js'

const mocks = vi.hoisted(() => ({ action: vi.fn(), error: vi.fn() }))
const docConfig = { versions: { drafts: { autosave: true } } }
function noop() {}
const config = { routes: { api: '/api' }, admin: {}, localization: false }
const i18n = { language: 'en' }
const t = (key: string) => key
const initialState = {
  description: {
    value: '',
    initialValue: '',
    valid: true,
    validate: (value: string) => (value ? true : 'Required description'),
  },
}
vi.mock('../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ docConfig, getDocPreferences: noop }),
}))
vi.mock('../../providers/Auth/index.js', () => ({ useAuth: () => ({ refreshCookie: noop }) }))
vi.mock('../../providers/Config/index.js', () => ({ useConfig: () => ({ config }) }))
vi.mock('../../providers/FormErrorHandler/index.js', () => ({ useFormErrorHandler: () => noop }))
vi.mock('../../providers/Locale/index.js', () => ({ useLocale: () => undefined }))
vi.mock('../../providers/Operation/index.js', () => ({ useOperation: () => 'update' }))
vi.mock('../../providers/RouterAdapter/index.js', () => ({ useRouter: () => ({}) }))
vi.mock('../../providers/RouteTransition/index.js', () => ({
  useRouteTransition: () => ({ startRouteTransition: noop }),
}))
vi.mock('../../providers/ServerFunctions/index.js', () => ({
  useServerFunctions: () => ({ getFormState: noop }),
}))
vi.mock('../../providers/Translation/index.js', () => ({ useTranslation: () => ({ i18n, t }) }))
vi.mock('../../providers/UploadHandlers/index.js', () => ({
  useUploadHandlers: () => ({ getUploadHandler: noop }),
}))
vi.mock('../../hooks/useThrottledEffect.js', () => ({ useThrottledEffect: () => {} }))
vi.mock('sonner', () => ({
  toast: {
    success: noop,
    error: mocks.error,
    promise: (pending: Promise<unknown>) => {
      void pending.catch(noop)
    },
  },
}))
vi.mock('../../elements/Toasts/fieldErrors.js', () => ({ FieldErrorsToast: () => null }))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let form: ReturnType<typeof useForm>
function Fixture() {
  form = useForm()
  return <output>{String(useFormSubmitted())}</output>
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // Next/TanStack inject these routing constants; the browser test runner does not.
  if (typeof process === 'undefined') {
    vi.stubGlobal('process', { env: { NEXT_BASE_PATH: '', NEXT_TRAILING_SLASH: 'false' } })
  }
  mocks.action
    .mockReset()
    .mockImplementation(() => Promise.resolve(Response.json({ doc: { id: 1 } })))
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

describe('autosave after failed publish (#18300)', () => {
  it('should keep submitted errors across unvalidated saves, then clear them after a valid publish', async () => {
    await act(() =>
      root.render(
        <Form action={mocks.action} initialState={initialState}>
          <Fixture />
        </Form>,
      ),
    )
    await act(() => form.submit())
    expect(container.textContent).toBe('true')
    expect(mocks.action).not.toHaveBeenCalled()
    expect(form.getField('description')).toMatchObject({
      valid: false,
      errorMessage: 'Required description',
    })

    await act(() => form.submit({ skipValidation: true, overrides: { _status: 'draft' } }))
    expect(container.textContent).toBe('true')
    expect(form.getField('description')).toMatchObject({
      valid: false,
      errorMessage: 'Required description',
    })

    await act(() =>
      form.dispatchFields({ type: 'UPDATE', path: 'description', value: 'Now valid' }),
    )
    await act(() => form.submit())
    expect(container.textContent).toBe('false')
    expect(form.getField('description').valid).toBe(true)
    expect(mocks.action).toHaveBeenCalledTimes(2)
  })
})
