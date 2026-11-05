import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reduceFieldsToValues } from 'payload/shared'

import { useForm } from '../../forms/Form/context.js'
import { useField } from '../../forms/useField/index.js'
import { EditManyDrawerContent } from './DrawerContent.js'

function noop() {}
const collection = {
  slug: 'pages',
  admin: {},
  labels: { singular: 'Page', plural: 'Pages' },
  fields: [
    { name: 'meta', type: 'group', fields: [{ name: 'title', type: 'text' }] },
    { name: 'custom', type: 'text' },
  ],
}
const config = { routes: { api: '/api' }, admin: {}, localization: false }
const i18n = { language: 'en' }
const t = (key: string) => key
const searchParams = new URLSearchParams()
const permissions = { collections: { pages: { fields: true, update: true, read: true } } }
vi.mock('./index.js', () => ({ baseClass: 'edit-many' }))
vi.mock('@faceless-ui/modal', () => ({ useModal: () => ({ closeModal: noop }) }))
vi.mock('../../providers/DocumentInfo/index.js', () => ({
  DocumentInfoProvider: ({ children }: any) => children,
  useDocumentInfo: () => ({ docConfig: collection, collectionSlug: 'pages' }),
}))
vi.mock('../../providers/Auth/index.js', () => ({
  useAuth: () => ({ refreshCookie: noop, permissions }),
}))
vi.mock('../../providers/Config/index.js', () => ({ useConfig: () => ({ config }) }))
vi.mock('../../providers/FormErrorHandler/index.js', () => ({ useFormErrorHandler: () => noop }))
vi.mock('../../providers/Locale/index.js', () => ({ useLocale: () => undefined }))
vi.mock('../../providers/RouterAdapter/index.js', () => ({
  useRouter: () => ({ replace: noop }),
  useSearchParams: () => searchParams,
}))
vi.mock('../../providers/RouteTransition/index.js', () => ({
  useRouteTransition: () => ({ startRouteTransition: noop }),
}))
vi.mock('../../providers/ServerFunctions/index.js', () => ({
  useServerFunctions: () => ({
    getFormState: async ({ formState }: any) => ({ state: formState }),
  }),
}))
vi.mock('../../providers/Translation/index.js', () => ({ useTranslation: () => ({ i18n, t }) }))
vi.mock('../../providers/UploadHandlers/index.js', () => ({
  useUploadHandlers: () => ({ getUploadHandler: noop }),
}))
vi.mock('../../hooks/useThrottledEffect.js', () => ({ useThrottledEffect: noop }))
vi.mock('../../hooks/useDebouncedEffect.js', () => ({ useDebouncedEffect: noop }))
vi.mock('../Button/index.js', () => ({ Button: () => null }))
vi.mock('../../forms/Submit/index.js', () => ({ FormSubmit: () => null }))
vi.mock('../FieldSelect/index.js', () => ({ FieldSelect: () => null }))
// Custom slots ignore the RenderField path prop and use the surrounding context, like plugin-seo.
vi.mock('../../forms/RenderFields/RenderField.js', () => ({
  RenderField: ({ clientFieldConfig }: any) => <CustomField label={clientFieldConfig.name} />,
}))
let form: ReturnType<typeof useForm>
function CustomField({ label }: { label: string }) {
  const { setValue, value } = useField()
  form = useForm()
  return (
    <button onClick={() => setValue(`${label} value`)} type="button">
      {label}: {String(value)}
    </button>
  )
}
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // Next/TanStack inject these routing constants; the browser test runner does not.
  if (typeof process === 'undefined') {
    vi.stubGlobal('process', { env: { NEXT_BASE_PATH: '', NEXT_TRAILING_SLASH: 'false' } })
  }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('bulk edit custom field paths (#18116)', () => {
  it('should write plain and nested custom fields to their configured paths', async () => {
    const selectedFields = [
      {
        value: {
          path: 'meta.title',
          field: { name: 'title', type: 'text' },
          fieldPermissions: true,
        },
      },
      {
        value: { path: 'custom', field: { name: 'custom', type: 'text' }, fieldPermissions: true },
      },
    ]
    await act(() =>
      root.render(
        <EditManyDrawerContent
          collection={collection as never}
          drawerSlug="edit-many"
          ids={[1, 2]}
          selectedFields={selectedFields as never}
          setSelectedFields={noop}
        />,
      ),
    )
    const buttons = container.querySelectorAll('button')
    await act(() => buttons[0]!.click())
    await act(() => buttons[1]!.click())

    expect(reduceFieldsToValues(form.getFields(), true)).toEqual({
      meta: { title: 'title value' },
      custom: 'custom value',
    })
    expect(form.getFields()).not.toHaveProperty('undefined')
  })
})
