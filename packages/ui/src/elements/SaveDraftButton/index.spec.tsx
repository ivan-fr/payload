import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

import { SaveDraftButton } from './index.js'

const mocks = vi.hoisted(() => ({
  config: { routes: { api: '/api' }, localization: false as unknown },
  submit: vi.fn(),
}))
vi.mock('../../providers/Config/index.js', () => ({ useConfig: () => ({ config: mocks.config }) }))
vi.mock('../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ id: 1, collectionSlug: 'pages', setUnpublishedVersionCount: () => {} }),
}))
vi.mock('../../providers/Locale/index.js', () => ({
  useLocale: () => (mocks.config.localization ? { code: 'fr' } : undefined),
}))
vi.mock('../../providers/Operation/index.js', () => ({ useOperation: () => 'update' }))
vi.mock('../../providers/EditDepth/index.js', () => ({ useEditDepth: () => 0 }))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../providers/UploadEdits/index.js', () => ({
  useUploadEdits: () => ({ uploadEdits: null }),
}))
vi.mock('../../hooks/useHotkey.js', () => ({ useHotkey: () => {} }))
vi.mock('../../forms/Form/context.js', () => ({
  useFormModified: () => true,
  useForm: () => ({ submit: mocks.submit }),
}))
vi.mock('../../forms/Submit/index.js', () => ({
  FormSubmit: ({ onClick }: any) => <button onClick={onClick}>Save draft</button>,
}))
afterEach(() => {
  vi.unstubAllGlobals()
  mocks.submit.mockClear()
})
it.each([false, true])(
  'should omit unnecessary fallback locale and preserve localized write semantics (localized: %s) (#17778)',
  async (localized) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('process', { env: {} })
    mocks.config.localization = localized
      ? { defaultLocale: 'en', locales: [{ code: 'en' }, { code: 'fr' }] }
      : false
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(() => root.render(<SaveDraftButton />))
      await act(() => host.querySelector('button')!.click())
      expect(mocks.submit).toHaveBeenCalledOnce()
      const url = new URL(mocks.submit.mock.calls[0]![0].action, 'https://example.com')
      expect(url.searchParams.get('fallback-locale')).toBe(localized ? 'false' : null)
      expect(url.searchParams.get('locale')).toBe(localized ? 'fr' : null)
      expect(url.searchParams.get('draft')).toBe('true')
    } finally {
      await act(() => root.unmount())
    }
  },
)
