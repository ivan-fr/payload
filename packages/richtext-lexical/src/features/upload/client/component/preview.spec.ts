import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  thumbnailProps: {} as Record<string, unknown>,
}))

vi.mock('@lexical/react/LexicalComposerContext.js', () => ({
  useLexicalComposerContext: () => [{}],
}))
vi.mock('@lexical/react/useLexicalEditable', () => ({ useLexicalEditable: () => false }))
vi.mock('@payloadcms/ui', () => ({
  Button: () => null,
  Pill: () => null,
  Thumbnail: (props: Record<string, unknown>) => {
    fixture.thumbnailProps = props
    return null
  },
  formatDrawerSlug: () => 'upload',
  useConfig: () => ({
    config: { routes: { api: '/api' }, serverURL: '' },
    getEntityConfig: () => ({ slug: 'media', labels: { singular: 'Media' } }),
  }),
  useEditDepth: () => 1,
  usePayloadAPI: () => [{ data: fixture.data }, { setParams: vi.fn() }],
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}))
vi.mock('../../../../lexical/config/client/EditorConfigProvider.js', () => ({
  useEditorConfigContext: () => ({
    uuid: 'editor',
    editorConfig: {
      resolvedFeatureMap: new Map([
        ['upload', { sanitizedClientFeatureProps: { collections: {} } }],
      ]),
    },
    fieldProps: { schemaPath: 'posts.content' },
  }),
}))
vi.mock('../../../../utilities/fieldsDrawer/Drawer.js', () => ({ FieldsDrawer: () => null }))
vi.mock('../../../../utilities/fieldsDrawer/useLexicalDocumentDrawer.js', () => ({
  useLexicalDocumentDrawer: () => ({
    closeDocumentDrawer: vi.fn(),
    DocumentDrawer: () => null,
    DocumentDrawerToggler: () => null,
  }),
}))
vi.mock('../../../../utilities/fieldsDrawer/useLexicalDrawer.js', () => ({
  useLexicalDrawer: () => ({ toggleDrawer: vi.fn() }),
}))

import { UploadComponent } from './index.js'

describe('Lexical upload image preview (#19318)', () => {
  beforeEach(() => {
    fixture.data = {
      mimeType: 'image/jpeg',
      width: 1600,
      height: 900,
      url: '/photo.jpg',
      thumbnailURL: '/photo-300x300.jpg',
    }
  })

  it('should preview the actual image framing instead of the Admin cropped thumbnail', () => {
    renderToStaticMarkup(
      createElement(UploadComponent, {
        className: 'LexicalEditorTheme__upload',
        nodeKey: 'upload',
        data: { relationTo: 'media', value: 1 },
      }),
    )
    expect(fixture.thumbnailProps).toMatchObject({
      fileSrc: '/photo.jpg',
      width: 1600,
      height: 900,
    })
  })

  it('should retain the thumbnail fallback when the original URL is unavailable', () => {
    fixture.data.url = null
    renderToStaticMarkup(
      createElement(UploadComponent, {
        className: 'LexicalEditorTheme__upload',
        nodeKey: 'upload',
        data: { relationTo: 'media', value: 1 },
      }),
    )
    expect(fixture.thumbnailProps.fileSrc).toBe('/photo-300x300.jpg')
  })

  it('should keep non-image uploads on the existing placeholder path', () => {
    fixture.data.mimeType = 'application/pdf'
    renderToStaticMarkup(
      createElement(UploadComponent, {
        className: 'LexicalEditorTheme__upload',
        nodeKey: 'upload',
        data: { relationTo: 'media', value: 1 },
      }),
    )
    expect(fixture.thumbnailProps.fileSrc).toBeNull()
  })
})
