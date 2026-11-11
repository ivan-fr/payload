import axe from 'axe-core'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { Button } from '../Button/index.js'
import { DocumentControls } from './index.js'
import '../../css/app.css'

const state = vi.hoisted(() => ({ hasPreview: false }))

afterEach(() => {
  document.documentElement.removeAttribute('data-enhanced-contrast')
  document.documentElement.removeAttribute('data-theme')
})

vi.mock('../../providers/Config/index.js', () => ({
  ConfigProvider: ({ children }: { children: React.ReactNode }) => children,
  PageConfigProvider: ({ children }: { children: React.ReactNode }) => children,
  useConfig: () => ({
    config: { admin: {}, routes: { admin: '/admin' } },
    getEntityConfig: ({ collectionSlug }: { collectionSlug?: string }) =>
      collectionSlug
        ? { admin: { preview: state.hasPreview }, slug: collectionSlug, versions: false }
        : undefined,
  }),
}))
vi.mock('../../providers/DocumentInfo/index.js', () => ({
  DocumentInfoProvider: ({ children }: { children: React.ReactNode }) => children,
  useDocumentInfo: () => ({}),
}))
vi.mock('../../providers/LivePreview/context.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../providers/LivePreview/context.js')>()),
  useLivePreviewContext: () => ({ isLivePreviewEnabled: false }),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  TranslationProvider: ({ children }: { children: React.ReactNode }) => children,
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}))
vi.mock('../../forms/Form/context.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../forms/Form/context.js')>()),
  useFormInitializing: () => false,
  useFormProcessing: () => false,
}))

it.each(['none', 'preview', 'null-preview'] as const)(
  'should keep a single gap between visible controls: %s (#19395)',
  async (preview) => {
    state.hasPreview = preview !== 'none'

    const screen = await render(
      <DocumentControls
        apiURL="/api/posts/1"
        BeforeDocumentControls={<Button margin={false}>Custom action</Button>}
        customComponents={{
          PreviewButton:
            preview === 'null-preview' ? <NullPreview /> : <Button margin={false}>Preview</Button>,
          SaveButton: <Button margin={false}>Save</Button>,
        }}
        hasSavePermission
        id="1"
        permissions={null}
        slug="posts"
        variant="drawerHeaderActions"
      />,
    )
    const custom = screen.getByRole('button', { name: 'Custom action' }).element()
    const save = screen.getByRole('button', { name: 'Save', exact: true }).element()
    const iconButtons = save.parentElement!.querySelector<HTMLElement>(
      '.doc-controls__icon-buttons',
    )!

    for (const button of [custom, save]) {
      expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(24)
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    }

    if (preview === 'preview') {
      expect(getComputedStyle(iconButtons).display).toBe('flex')
      expect(iconButtons.getBoundingClientRect().left - custom.getBoundingClientRect().right).toBe(
        8,
      )
      expect(save.getBoundingClientRect().left - iconButtons.getBoundingClientRect().right).toBe(8)
      await expect
        .element(screen.getByRole('button', { name: 'Preview', exact: true }))
        .toBeVisible()
    } else {
      expect(getComputedStyle(iconButtons).display).toBe('none')
      expect(save.getBoundingClientRect().left - custom.getBoundingClientRect().right).toBe(8)
    }

    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme
      document.documentElement.setAttribute('data-enhanced-contrast', '')

      const results = await axe.run(custom.closest('.doc-controls')!, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      })

      expect(results.violations).toEqual([])
    }
  },
)

function NullPreview() {
  return null
}
