import { initI18n } from '@payloadcms/translations'
import { en } from '@payloadcms/translations/languages/en'
import { fr } from '@payloadcms/translations/languages/fr'
import { pl } from '@payloadcms/translations/languages/pl'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

import { LoadMoreRow } from './index.js'

const mocks = vi.hoisted(() => ({ i18n: undefined as any }))
vi.mock('../../providers/Translation/index.js', () => ({ useTranslation: () => mocks.i18n }))
vi.mock('../Button/index.js', () => ({
  Button: ({ children, disabled, onClick }: any) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))
afterEach(() => vi.unstubAllGlobals())

it.each([
  ['en', 'Showing 2 of 5', 'Showing 5 of 5'],
  ['fr', 'Affichage de 2 sur 5', 'Affichage de 5 sur 5'],
  ['pl', 'Wyświetlanie 2 z 5', 'Wyświetlanie 5 z 5'],
])(
  'should translate pending and complete counts in %s without changing loading controls',
  async (language, partial, complete) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mocks.i18n = await initI18n({
      config: { supportedLanguages: { en, fr, pl }, fallbackLanguage: 'en' },
      context: 'client',
      language,
    })
    const onLoadMore = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    try {
      await act(() =>
        root.render(<LoadMoreRow currentCount={2} totalDocs={5} hasMore onLoadMore={onLoadMore} />),
      )
      expect(container.textContent).toContain(partial)
      await act(() => container.querySelector('button')!.click())
      expect(onLoadMore).toHaveBeenCalledOnce()
      await act(() =>
        root.render(
          <LoadMoreRow currentCount={2} totalDocs={5} hasMore isLoading onLoadMore={onLoadMore} />,
        ),
      )
      expect(container.querySelector('button')!.disabled).toBe(true)
      await act(() =>
        root.render(
          <LoadMoreRow currentCount={2} totalDocs={5} hasMore={false} onLoadMore={onLoadMore} />,
        ),
      )
      expect(container.textContent).toBe(complete)
      expect(container.querySelector('button')).toBeNull()
    } finally {
      await act(() => root.unmount())
    }
  },
)
