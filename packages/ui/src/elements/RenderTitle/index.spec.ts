import type { I18n } from '@payloadcms/translations'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ id: undefined as number | string | undefined, title: '' }))
vi.mock('../../providers/Config/index.js', () => ({
  useConfig: () => ({ config: { routes: { admin: '/admin' } } }),
}))
vi.mock('../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ id: fixture.id, collectionSlug: 'posts' }),
}))
vi.mock('../../providers/DocumentTitle/index.js', () => ({
  useDocumentTitle: () => ({ title: fixture.title }),
}))
vi.mock('../Drawer/index.js', () => ({ useDrawerDepth: () => 0 }))
vi.mock('../Link/index.js', () => ({ Link: () => null }))

import { formatDocTitle } from '../../utilities/formatDocTitle/index.js'
import { RenderTitle } from './index.js'

describe('document titles (#19199)', () => {
  it.each([4, 0, 'text-id'])(
    'should use the ID label for an untitled document with ID %s',
    (id) => {
      fixture.id = id
      fixture.title = String(id)
      const html = renderToStaticMarkup(createElement(RenderTitle))
      expect(html).toContain('render-title--has-id')
      expect(html).toContain('id-label__prefix">ID</span>')
    },
  )
  it('should preserve named titles and avoid treating an absent ID as a title', () => {
    fixture.id = 4
    fixture.title = 'Article'
    expect(renderToStaticMarkup(createElement(RenderTitle))).not.toContain('render-title--has-id')
    fixture.id = undefined
    fixture.title = 'undefined'
    expect(renderToStaticMarkup(createElement(RenderTitle))).not.toContain('render-title--has-id')
  })
  it('should leave the complete untitled text to the translation, without adding brackets', () => {
    const i18n = { t: () => 'Namnlös' } as unknown as I18n
    expect(formatDocTitle({ data: {} as never, dateFormat: 'yyyy-MM-dd', i18n })).toBe('Namnlös')
    expect(
      formatDocTitle({ data: {} as never, dateFormat: 'yyyy-MM-dd', i18n, fallback: 'Fallback' }),
    ).toBe('Fallback')
  })
})
