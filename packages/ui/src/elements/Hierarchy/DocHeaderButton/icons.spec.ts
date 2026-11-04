import type { Payload } from 'payload'
import type { ReactNode } from 'react'

import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ renderMapped: vi.fn(() => null) }))
vi.mock('../../RenderServerComponent/index.js', () => ({
  RenderServerComponent: fixture.renderMapped,
}))
vi.mock('../../../exports/client/index.js', () => ({
  HierarchyButtonClient: ({ Icon, SmallIcon }: { Icon: ReactNode; SmallIcon: ReactNode }) =>
    createElement(Fragment, null, Icon, SmallIcon),
}))
import { HierarchyButton } from './index.server.js'

describe('hierarchy header default icon forms (#18872)', () => {
  it.each([false, true])(
    'should render default string/object icons without import-map lookup (object: %s)',
    (object) => {
      fixture.renderMapped.mockClear()
      const path = '@payloadcms/ui#FolderIcon'
      const Icon = object ? { path, clientProps: { className: 'custom-folder' } } : path
      const SmallIcon = object ? { path, clientProps: { className: 'small-folder' } } : path
      const payload = {
        config: {
          collections: [
            { slug: 'folders', hierarchy: { admin: { components: { Icon, SmallIcon } } } },
          ],
        },
        importMap: {},
      } as unknown as Payload
      const html = renderToStaticMarkup(
        createElement(HierarchyButton, {
          fieldName: 'parent',
          hierarchyCollectionSlug: 'folders',
          payload,
        }),
      )
      expect(fixture.renderMapped).not.toHaveBeenCalled()
      expect(html.match(/icon--folder/g)).toHaveLength(2)
      if (object) {
        expect(html).toContain('custom-folder')
        expect(html).toContain('small-folder')
      }
    },
  )
  it.each(['/Custom#Icon', { path: '@payloadcms/ui#FolderIcon', exportName: 'CustomIcon' }])(
    'should still resolve custom icons through the import map: %s',
    (Icon) => {
      fixture.renderMapped.mockClear()
      const payload = {
        config: {
          collections: [{ slug: 'folders', hierarchy: { admin: { components: { Icon } } } }],
        },
        importMap: {},
      } as unknown as Payload
      renderToStaticMarkup(
        createElement(HierarchyButton, {
          fieldName: 'parent',
          hierarchyCollectionSlug: 'folders',
          payload,
        }),
      )
      expect(fixture.renderMapped).toHaveBeenCalledWith(
        expect.objectContaining({ Component: Icon }),
      )
    },
  )
})
