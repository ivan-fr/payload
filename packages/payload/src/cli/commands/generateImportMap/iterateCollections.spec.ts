import type { SanitizedCollectionConfig, SanitizedConfig } from '../../../index.js'

import { describe, expect, it, vi } from 'vitest'

import { iterateCollections } from './iterateCollections.js'

describe('hierarchy icon import maps (#18872)', () => {
  it.each(['@payloadcms/ui#FolderIcon', '@payloadcms/ui#TagIcon'])(
    'should register %s and a custom SmallIcon without a sidebar tab',
    (path) => {
      const Icon = { path, clientProps: { className: 'custom' } }
      const SmallIcon = { path: '/SmallIcon.tsx#SmallIcon' }
      const addToImportMap = vi.fn()
      iterateCollections({
        addToImportMap,
        baseDir: '/',
        config: {} as SanitizedConfig,
        imports: {},
        importMap: {},
        collections: [
          {
            slug: 'hierarchy',
            fields: [],
            admin: {},
            hierarchy: { admin: { injectSidebarTab: false, components: { Icon, SmallIcon } } },
          },
        ] as unknown as SanitizedCollectionConfig[],
      })
      expect(addToImportMap).toHaveBeenCalledWith(Icon)
      expect(addToImportMap).toHaveBeenCalledWith(SmallIcon)
    },
  )
  it('should still support ordinary collections', () => {
    expect(() =>
      iterateCollections({
        addToImportMap: vi.fn(),
        baseDir: '/',
        config: {} as SanitizedConfig,
        imports: {},
        importMap: {},
        collections: [{ slug: 'posts', fields: [], admin: {} }] as SanitizedCollectionConfig[],
      }),
    ).not.toThrow()
  })
})
