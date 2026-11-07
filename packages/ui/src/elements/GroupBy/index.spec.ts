import type { ClientField } from 'payload'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

import { GroupByButton } from './index.js'

vi.mock('../../providers/Auth/index.js', () => ({
  useAuth: () => ({ permissions: { collections: { posts: { fields: true } } } }),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', fallbackLanguage: 'en', t: (key: string) => key },
    t: () => 'Group by',
  }),
}))
vi.mock('../Button/index.js', () => ({ Button: () => null }))
vi.mock('../Popup/index.js', () => ({ Popup: ({ render }) => render({ close: () => {} }) }))
vi.mock('./Popup.js', () => ({
  GroupByPopup: ({ filteredFields, isActive }) =>
    React.createElement(
      'output',
      null,
      JSON.stringify({ paths: filteredFields.map(({ fieldPath }) => fieldPath), isActive }),
    ),
}))

it('should exclude array descendants from the real group-by control and ignore an invalid selection (#19134)', () => {
  const markup = renderToStaticMarkup(
    React.createElement(GroupByButton, {
      collectionSlug: 'posts',
      onChange: vi.fn(),
      value: 'links.label',
      fields: [
        { name: 'title', type: 'text', label: 'Title', admin: {} },
        {
          name: 'links',
          type: 'array',
          label: 'Links',
          admin: {},
          fields: [{ name: 'label', type: 'text', label: 'Label', admin: {} }],
        },
      ] as ClientField[],
    }),
  )

  expect(markup).not.toContain('links.label')
  expect(markup).toContain('title')
  expect(markup).toContain('false')
})

it('should retain a relationship-backed virtual scalar with its query path', () => {
  const markup = renderToStaticMarkup(
    React.createElement(GroupByButton, {
      collectionSlug: 'posts',
      onChange: vi.fn(),
      value: 'unrestricted.name',
      fields: [
        {
          name: 'virtualName',
          type: 'text',
          label: 'Virtual name',
          virtual: 'unrestricted.name',
          admin: {},
        },
      ] as ClientField[],
    }),
  )
  expect(markup).toContain('unrestricted.name')
  expect(markup).toContain('true')
})
