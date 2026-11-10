import { initI18n } from '@payloadcms/translations'
import { en } from '@payloadcms/translations/languages/en'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

import { GroupFieldComponent } from './index.js'

const mocks = vi.hoisted(() => ({ i18n: undefined as any }))
vi.mock('../../providers/Translation/index.js', () => ({ useTranslation: () => mocks.i18n }))
vi.mock('../../providers/Locale/index.js', () => ({
  useLocale: () => ({ code: 'fr', label: 'French' }),
}))
vi.mock('../../forms/useField/index.js', () => ({ useField: () => ({ errorPaths: [] }) }))
vi.mock('../../forms/Form/context.js', () => ({
  useFormSubmitted: () => false,
  useForm: () => ({ uuid: 'test' }),
}))
vi.mock('../../forms/RenderFields/index.js', () => ({ RenderFields: () => null }))
vi.mock('../../forms/withCondition/index.js', () => ({
  withCondition: (Component: unknown) => Component,
}))
vi.mock('../../elements/Collapsible/provider.js', () => ({
  useCollapsible: () => ({ isWithinCollapsible: false }),
}))
vi.mock('../../elements/ErrorPill/index.js', () => ({ ErrorPill: () => null }))
vi.mock('../../fields/FieldDescription/index.js', () => ({ FieldDescription: () => null }))
vi.mock('../../providers/EditDepth/index.js', () => ({ useEditDepth: () => 0 }))
afterEach(() => vi.unstubAllGlobals())
it.each([false, true])(
  'should show the locale on a localized group only (localized: %s) (#17639)',
  async (localized) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mocks.i18n = await initI18n({
      config: { supportedLanguages: { en }, fallbackLanguage: 'en' },
      context: 'client',
      language: 'en',
    })
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(() =>
        root.render(
          <GroupFieldComponent
            field={{ name: 'details', type: 'group', label: 'Details', localized, fields: [] }}
            path="details"
          />,
        ),
      )
      expect(host.querySelector('h3')!.textContent).toBe(localized ? 'Details— French' : 'Details')
      expect(host.querySelector('.localized') !== null).toBe(localized)
      expect(host.querySelector('label')).toBeNull()
    } finally {
      await act(() => root.unmount())
    }
  },
)
