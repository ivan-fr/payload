import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

import { EditManyDrawerContent } from './DrawerContent.js'

const mocks = vi.hoisted(() => ({
  form: undefined as any,
  replace: vi.fn(),
  close: vi.fn(),
  config: { routes: { api: '/api' } },
  search: new URLSearchParams(),
  getFormState: vi.fn(),
}))
vi.mock('@faceless-ui/modal', () => ({ useModal: () => ({ closeModal: mocks.close }) }))
vi.mock('./index.js', () => ({ baseClass: 'edit-many' }))
vi.mock('../../forms/Form/index.js', () => ({
  Form: (props: any) => {
    mocks.form = props
    return null
  },
}))
vi.mock('../../forms/Form/context.js', () => ({ useForm: () => ({ submit: vi.fn() }) }))
vi.mock('../../providers/DocumentInfo/index.js', () => ({
  DocumentInfoProvider: ({ children }: any) => children,
}))
vi.mock('../../providers/Auth/index.js', () => ({
  useAuth: () => ({ permissions: { collections: { pages: { fields: true } } } }),
}))
vi.mock('../../providers/Config/index.js', () => ({ useConfig: () => ({ config: mocks.config }) }))
vi.mock('../../providers/Locale/index.js', () => ({ useLocale: () => undefined }))
vi.mock('../../providers/RouterAdapter/index.js', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.search,
}))
vi.mock('../../providers/ServerFunctions/index.js', () => ({
  useServerFunctions: () => ({ getFormState: mocks.getFormState }),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}))
vi.mock('../../forms/RenderFields/RenderField.js', () => ({ RenderField: () => null }))
vi.mock('../../forms/Submit/index.js', () => ({ FormSubmit: () => null }))
vi.mock('../Button/index.js', () => ({ Button: () => null }))
vi.mock('../FieldSelect/index.js', () => ({ FieldSelect: () => null }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
it.each([
  { selectAll: false, isPartial: false },
  { selectAll: true, isPartial: false },
  { selectAll: false, isPartial: true },
  { selectAll: true, isPartial: true },
])(
  'should preserve the live URL after bulk edits (all: $selectAll, partial: $isPartial) (#17667)',
  async ({ selectAll, isPartial }) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('process', { env: {} })
    const original = window.location.href
    const search = new URLSearchParams({
      columns: JSON.stringify(['title', 'updatedAt']),
      limit: '10',
      page: '9',
      'where[title][equals]': 'Keep',
      depth: '1',
    })
    search.append('tag', 'a')
    search.append('tag', 'b')
    history.replaceState(null, '', `?${search}`)
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(() =>
        root.render(
          <EditManyDrawerContent
            collection={
              { slug: 'pages', fields: [], labels: { plural: 'Pages', singular: 'Page' } } as never
            }
            drawerSlug="edit-pages"
            ids={[1, 2]}
            selectedFields={[]}
            setSelectedFields={() => {}}
            selectAll={selectAll}
            count={2}
          />,
        ),
      )
      await act(() => (isPartial ? mocks.form.onPartialSuccess() : mocks.form.onSuccess()))
      const next = new URLSearchParams(mocks.replace.mock.calls[0]![0])
      expect(next.get('columns')).toBe(search.get('columns'))
      expect(next.get('limit')).toBe('10')
      expect(next.get('where[title][equals]')).toBe('Keep')
      expect(next.getAll('tag')).toEqual(['a', 'b'])
      expect(next.get('page')).toBe(selectAll ? '1' : '9')
      expect(next.get('_r')).toMatch(/^\d+$/)
      expect(mocks.close).toHaveBeenCalledWith('edit-pages')
    } finally {
      await act(() => root.unmount())
      history.replaceState(null, '', original)
    }
  },
)
