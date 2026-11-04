import type { DocumentInfoContext } from './types.js'
import type { ReactNode } from 'react'

import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  preferences: { fields: { sections: { collapsed: ['de-one', 'de-two', 'en-one'], tabIndex: 2 } } },
  api: undefined as DocumentInfoContext | undefined,
  setPreference: vi.fn(),
}))
vi.mock('../Config/index.js', () => ({
  useConfig: () => ({
    config: { admin: { dateFormat: 'yyyy-MM-dd' }, collections: [], routes: { api: '/api' } },
    getEntityConfig: ({ collectionSlug }: { collectionSlug?: string }) =>
      collectionSlug ? { slug: collectionSlug, versions: false } : undefined,
  }),
}))
vi.mock('../../providers/Auth/index.js', () => ({ useAuth: () => ({ permissions: {} }) }))
vi.mock('../Locale/index.js', () => ({
  useLocale: () => ({ code: 'en' }),
  useLocaleLoading: () => ({ localeIsLoading: false }),
}))
vi.mock('../Translation/index.js', () => ({ useTranslation: () => ({ i18n: {} }) }))
vi.mock('../Preferences/index.js', () => ({
  usePreferences: () => ({
    getPreference: async () => fixture.preferences,
    setPreference: fixture.setPreference,
  }),
}))
vi.mock('../DocumentTitle/index.js', () => ({
  DocumentTitleProvider: ({ children }: { children: ReactNode }) =>
    createElement(Fragment, null, children),
}))
vi.mock('../UploadEdits/index.js', () => ({
  useUploadEdits: () => ({}),
  UploadEditsProvider: ({ children }: { children: ReactNode }) =>
    createElement(Fragment, null, children),
}))
vi.mock('./useGetDocPermissions.js', () => ({ useGetDocPermissions: () => vi.fn() }))
import { DocumentInfoProvider, useDocumentInfo } from './index.js'

const Capture = () => {
  fixture.api = useDocumentInfo()
  return null
}

describe('document preference writes across locales (#18843)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderToStaticMarkup(
      createElement(DocumentInfoProvider, {
        collectionSlug: 'posts',
        id: 'doc',
        initialData: {},
        initialState: {},
        children: createElement(Capture),
      }),
    )
  })
  it('should retain other-locale rows in the actual provider preference write', async () => {
    await fixture.api!.setDocFieldPreferences('sections', { collapsed: ['en-two'] }, [
      'en-one',
      'en-two',
    ])
    expect(fixture.setPreference).toHaveBeenCalledWith('collection-posts-doc', {
      fields: { sections: { tabIndex: 2, collapsed: ['de-one', 'de-two', 'en-two'] } },
    })
  })
  it('should expand all current rows while retaining other-locale rows', async () => {
    await fixture.api!.setDocFieldPreferences('sections', { collapsed: [] }, ['en-one', 'en-two'])
    expect(fixture.setPreference).toHaveBeenCalledWith('collection-posts-doc', {
      fields: { sections: { tabIndex: 2, collapsed: ['de-one', 'de-two'] } },
    })
  })
  it('should preserve replacement semantics for existing callers without current row IDs', async () => {
    await fixture.api!.setDocFieldPreferences('sections', { collapsed: [] })
    expect(fixture.setPreference).toHaveBeenCalledWith('collection-posts-doc', {
      fields: { sections: { tabIndex: 2, collapsed: [] } },
    })
  })
})
