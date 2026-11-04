import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  where: {} as Record<string, unknown>,
  captured: {} as Record<string, unknown>,
}))
vi.mock('../../../providers/Selection/index.js', () => ({
  SelectAllStatus: { AllAvailable: 'all' },
  useSelection: () => ({
    count: 10,
    selectAll: 'all',
    selectedIDs: [],
    totalDocs: 10,
    toggleAll: vi.fn(),
  }),
}))
vi.mock('../../../providers/Auth/index.js', () => ({
  useAuth: () => ({ permissions: { collections: { posts: { delete: true, update: true } } } }),
}))
vi.mock('../../../providers/RouterAdapter/index.js', () => ({
  useRouter: () => ({}),
  useSearchParams: () => new URLSearchParams('where[title][equals]=visible'),
}))
vi.mock('../../../providers/RouteCache/index.js', () => ({
  useRouteCache: () => ({ clearRouteCache: vi.fn() }),
}))
vi.mock('../../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../../elements/ListSelection/index.js', () => ({
  ListSelectionButton: () => null,
  ListSelection_v4: ({ SelectionActions }: { SelectionActions: unknown[] }) =>
    createElement(Fragment, null, ...(SelectionActions as never[])),
}))
vi.mock('../../../elements/DeleteMany/index.js', () => ({
  DeleteMany: ({ where }: { where: unknown }) => {
    fixture.captured.delete = where
    return null
  },
}))
vi.mock('../../../elements/EditMany/index.js', () => ({
  EditMany: ({ where }: { where: unknown }) => {
    fixture.captured.edit = where
    return null
  },
}))
vi.mock('../../../elements/PublishMany/index.js', () => ({
  PublishMany: ({ where }: { where: unknown }) => {
    fixture.captured.publish = where
    return null
  },
}))
vi.mock('../../../elements/UnpublishMany/index.js', () => ({
  UnpublishMany: ({ where }: { where: unknown }) => {
    fixture.captured.unpublish = where
    return null
  },
}))
vi.mock('../../../elements/RestoreMany/index.js', () => ({
  RestoreMany: ({ where }: { where: unknown }) => {
    fixture.captured.restore = where
    return null
  },
}))

import { ListSelection } from './index.js'
import { ListBaseFilterContext } from './BaseFilterContext.js'

const baseFilter = { archived: { not_equals: true } }

describe('bulk list constraints (#19189)', () => {
  beforeEach(() => {
    fixture.captured = {}
  })
  it('should apply the list constraint and URL filter to every across-pages mutation', () => {
    renderToStaticMarkup(
      createElement(ListSelection, {
        collectionConfig: { slug: 'posts' } as never,
        label: 'Posts',
        where: baseFilter,
      }),
    )
    for (const action of ['delete', 'edit', 'publish', 'unpublish']) {
      expect(fixture.captured[action]).toEqual({
        and: [baseFilter, { title: { equals: 'visible' } }],
      })
    }
  })
  it('should preserve trash and restore constraints with the list filter', () => {
    renderToStaticMarkup(
      createElement(ListSelection, {
        collectionConfig: { slug: 'posts', trash: true } as never,
        label: 'Posts',
        where: baseFilter,
        viewType: 'trash',
      }),
    )
    expect(JSON.stringify(fixture.captured.delete)).toContain('archived')
    expect(JSON.stringify(fixture.captured.delete)).toContain('deletedAt')
    expect(fixture.captured.restore).toEqual({
      and: [baseFilter, { title: { equals: 'visible' } }],
    })
  })
})

it('should combine inherited base filters with group and URL constraints', () => {
  const groupWhere = { category: { equals: 'group' } }
  renderToStaticMarkup(
    createElement(
      ListBaseFilterContext,
      { value: baseFilter },
      createElement(ListSelection, {
        collectionConfig: { slug: 'posts' } as never,
        label: 'Posts',
        where: groupWhere,
      }),
    ),
  )
  expect(fixture.captured.delete).toEqual({
    and: [groupWhere, { title: { equals: 'visible' } }, baseFilter],
  })
})
