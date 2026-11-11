import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { UnpublishManyDrawerContent } from '../UnpublishMany/DrawerContent.js'
import { PublishManyDrawerContent } from './DrawerContent.js'

const mocks = vi.hoisted(() => ({
  confirm: undefined as any,
  error: vi.fn(),
  success: vi.fn(),
  patch: vi.fn(),
  replace: vi.fn(),
  clear: vi.fn(),
  config: { routes: { api: '/api' } },
  search: new URLSearchParams(),
}))
vi.mock('../../providers/Config/index.js', () => ({ useConfig: () => ({ config: mocks.config }) }))
vi.mock('../../providers/Locale/index.js', () => ({ useLocale: () => ({ code: 'en' }) }))
vi.mock('../../providers/RouteCache/index.js', () => ({
  useRouteCache: () => ({ clearRouteCache: mocks.clear }),
}))
vi.mock('../../providers/RouterAdapter/index.js', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.search,
}))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}))
vi.mock('../../utilities/api.js', () => ({ requests: { patch: mocks.patch } }))
vi.mock('../ConfirmationModal/index.js', () => ({
  ConfirmationModal: (props: any) => {
    mocks.confirm = props.onConfirm
    return null
  },
}))
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success } }))
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('process', { env: {} })
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())
for (const Component of [PublishManyDrawerContent, UnpublishManyDrawerContent]) {
  for (const partial of [false, true]) {
    it(`should show one grouped failure for ${Component.name} (partial: ${partial}) (#18837)`, async () => {
      mocks.patch.mockImplementation(async () =>
        Response.json(
          {
            docs: partial ? [{ id: 1 }] : [],
            errors: [
              { message: 'Refused', isPublic: true },
              { message: 'Refused', isPublic: true },
            ],
            message: 'Unable to update selection',
          },
          { status: 400 },
        ),
      )
      const onSuccess = vi.fn()
      const host = document.createElement('div')
      const root = createRoot(host)
      try {
        await act(() =>
          root.render(
            <Component
              collection={
                {
                  slug: 'pages',
                  labels: { plural: 'Pages', singular: 'Page' },
                  fields: [],
                } as never
              }
              drawerSlug="selection"
              ids={[1, 2]}
              selectAll={false}
              onSuccess={onSuccess}
            />,
          ),
        )
        await act(() => mocks.confirm())
        expect(mocks.error).toHaveBeenCalledExactlyOnceWith('Unable to update selection', {
          description: 'Refused',
        })
        expect(onSuccess).toHaveBeenCalledTimes(partial ? 1 : 0)
        expect(mocks.replace).toHaveBeenCalledTimes(partial ? 1 : 0)
        expect(mocks.clear).toHaveBeenCalledTimes(partial ? 1 : 0)
      } finally {
        await act(() => root.unmount())
      }
    })
  }
}
