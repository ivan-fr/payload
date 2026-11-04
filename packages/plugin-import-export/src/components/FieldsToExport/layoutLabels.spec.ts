import type { ClientField } from 'payload'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { reduceFields } from './reduceFields.js'

const labels = ({ fields }: { fields: ClientField[] }) =>
  reduceFields({ fields }).map(({ label, value }) => ({
    value,
    label: renderToStaticMarkup(React.createElement('div', null, label))
      .replace(/<[^>]*>/g, '')
      .replace(/&gt;/g, '>'),
  }))

describe('export layout labels (#17882)', () => {
  it.each(['row', 'collapsible', 'group'])('should skip a nameless %s prefix', (type) => {
    const fields = [
      {
        type,
        label: type === 'collapsible' ? 'Presentation' : undefined,
        fields: [{ type: 'text', name: 'title', label: 'Title' }],
      },
    ] as ClientField[]
    expect(labels({ fields })).toEqual([{ value: 'title', label: 'Title' }])
  })

  it('should preserve a named group prefix through nested layout wrappers', () => {
    const fields: ClientField[] = [
      {
        name: 'meta',
        type: 'group',
        label: 'SEO',
        fields: [{ type: 'row', fields: [{ name: 'title', type: 'text', label: 'Title' }] }],
      },
    ]
    expect(labels({ fields })).toEqual([{ value: 'meta.title', label: 'SEO > Title' }])
  })

  it('should preserve disabled-field paths through layout wrappers', () => {
    const fields: ClientField[] = [{ type: 'row', fields: [{ name: 'title', type: 'text' }] }]
    expect(reduceFields({ fields, disabledFields: ['title'] })).toEqual([])
  })
})
