import type { FormState } from 'payload'

import { Activity, StrictMode } from 'react'
import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'

vi.mock('../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ docConfig: {} }),
}))
vi.mock('../../providers/DocumentTitle/index.js', () => ({ useDocumentTitle: () => ({}) }))
vi.mock('../../providers/Auth/index.js', () => ({ useAuth: () => ({ refreshCookie: vi.fn() }) }))
vi.mock('../../providers/Config/index.js', () => ({
  useConfig: () => ({ config: { routes: { api: '/api' }, admin: {}, localization: false } }),
}))
vi.mock('../../providers/FormErrorHandler/index.js', () => ({ useFormErrorHandler: () => vi.fn() }))
vi.mock('../../providers/Locale/index.js', () => ({ useLocale: () => ({ code: 'en' }) }))
vi.mock('../../providers/Operation/index.js', () => ({ useOperation: () => 'update' }))
vi.mock('../../providers/RouterAdapter/index.js', () => ({ useRouter: () => ({}) }))
vi.mock('../../providers/RouteTransition/index.js', () => ({
  useRouteTransition: () => ({ startRouteTransition: vi.fn() }),
}))
vi.mock('../../providers/ServerFunctions/index.js', () => ({
  useServerFunctions: () => ({ getFormState: vi.fn() }),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: {}, t: (key: string) => key }),
}))
vi.mock('../../providers/UploadHandlers/index.js', () => ({
  useUploadHandlers: () => ({ getUploadHandler: vi.fn() }),
}))
vi.mock('../../hooks/useEffectEvent.js', () => ({ useEffectEvent: (fn: unknown) => fn }))
vi.mock('../../hooks/useDebouncedEffect.js', () => ({ useDebouncedEffect: vi.fn() }))
vi.mock('../../hooks/useThrottledEffect.js', () => ({ useThrottledEffect: vi.fn() }))

import { Form, useAllFormFields } from './index.js'

const initialState: FormState = {
  images: { initialValue: ['initial'], value: ['initial'], valid: true },
}
const changedState: FormState = {
  images: { initialValue: ['changed'], value: ['changed'], valid: true },
}

function Editor() {
  const [fields, dispatch] = useAllFormFields()
  return (
    <>
      <button
        onClick={() => dispatch({ type: 'UPDATE', path: 'images', value: ['initial', 'added'] })}
        type="button"
      >
        Add image
      </button>
      <output>{JSON.stringify(fields.images?.value)}</output>
    </>
  )
}
function Fixture({
  hidden = false,
  state = initialState,
}: {
  hidden?: boolean
  state?: FormState
}) {
  return (
    <StrictMode>
      <Activity mode={hidden ? 'hidden' : 'visible'}>
        <Form initialState={state} el="div">
          <Editor />
        </Form>
      </Activity>
    </StrictMode>
  )
}

test('should retain edits when Activity reconnects effects and apply actual initial-state changes', async () => {
  const screen = await render(<Fixture />)
  await screen.getByRole('button', { name: 'Add image' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent('["initial","added"]')
  await screen.rerender(<Fixture hidden />)
  await screen.rerender(<Fixture />)
  await expect.element(screen.getByRole('status')).toHaveTextContent('["initial","added"]')
  await screen.rerender(<Fixture state={changedState} />)
  await expect.element(screen.getByRole('status')).toHaveTextContent('["changed"]')
  await screen.rerender(<Fixture />)
  await expect.element(screen.getByRole('status')).toHaveTextContent('["initial"]')
})
