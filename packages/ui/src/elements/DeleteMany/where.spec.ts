import type { Where } from 'payload'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as qs from 'qs-esm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  confirm: undefined as undefined | (() => Promise<void>),
  request: vi.fn(),
}))
vi.mock('@faceless-ui/modal', () => ({ useModal: () => ({ openModal: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../providers/Config/index.js', () => ({
  useConfig: () => ({
    config: {
      routes: { api: '/api' },
      collections: [{ slug: 'posts', labels: { singular: 'Post', plural: 'Posts' } }],
    },
  }),
}))
vi.mock('../../providers/Locale/index.js', () => ({ useLocale: () => ({ code: 'en' }) }))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}))
vi.mock('../../utilities/api.js', () => ({
  requests: { delete: fixture.request, patch: fixture.request },
}))
vi.mock('../../fields/Checkbox/Input.js', () => ({ CheckboxInput: () => null }))
vi.mock('../ListSelection/index.js', () => ({ ListSelectionButton: () => null }))
vi.mock('../Translation/index.js', () => ({ Translation: () => null }))
vi.mock('../ConfirmationModal/index.js', () => ({
  ConfirmationModal: ({ onConfirm }: { onConfirm: () => Promise<void> }) => {
    fixture.confirm = onConfirm
    return null
  },
}))
import { DeleteMany } from './index.js'

describe('bulk deletion requires an explicit match-all predicate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fixture.request.mockResolvedValue({
      status: 200,
      json: async () => ({ docs: [], errors: [], totalDocs: 0 }),
    })
  })
  it.each([undefined, {}, { and: [] }])(
    'should serialize a valid where for unrestricted selection: %s',
    async (where) => {
      renderToStaticMarkup(
        createElement(DeleteMany, {
          selections: { posts: { all: true, totalCount: 10 } },
          where,
          hasDeletePermission: true,
        }),
      )
      await fixture.confirm!()
      const query = qs.parse(fixture.request.mock.calls[0][0].split('?')[1])
      expect(JSON.stringify(query.where)).toContain('not_equals')
      expect(query.where).toBeDefined()
    },
  )
  it('should retain base filters and trash constraints', async () => {
    const where: Where = { tenant: { equals: 'own' } }
    renderToStaticMarkup(
      createElement(DeleteMany, {
        selections: { posts: { all: true, totalCount: 10 } },
        where,
        viewType: 'trash',
        hasDeletePermission: true,
      }),
    )
    await fixture.confirm!()
    const query = qs.parse(fixture.request.mock.calls[0][0].split('?')[1])
    expect(JSON.stringify(query.where)).toContain('tenant')
    expect(JSON.stringify(query.where)).toContain('deletedAt')
  })
})
