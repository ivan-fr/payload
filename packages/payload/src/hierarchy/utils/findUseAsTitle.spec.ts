import type { CollectionConfig, Field } from '../../index.js'

import { describe, expect, it } from 'vitest'

import { findFieldByName, findUseAsTitleField } from './findUseAsTitle.js'

const title: Field = { name: 'name', type: 'text', localized: true }
const other: Field = { name: 'description', type: 'textarea' }
const config = (fields: Field[]): CollectionConfig => ({
  slug: 'sections',
  admin: { useAsTitle: 'name' },
  fields,
})

describe('hierarchy title lookup (#18816)', () => {
  for (const reverse of [false, true]) {
    it(`should search every unnamed tab, title first: ${!reverse}`, () => {
      const tabs = [
        { label: 'General', fields: [title] },
        { label: 'Details', fields: [other] },
      ]
      const collection = config([{ type: 'tabs', tabs: reverse ? tabs.reverse() : tabs }])
      expect(findUseAsTitleField(collection)).toEqual({ titleFieldName: 'name', localized: true })
      expect(findFieldByName(collection, 'description')).toEqual({
        fieldName: 'description',
        localized: false,
      })
    })
  }
  it('should continue past empty layout branches and find nested unnamed fields', () => {
    expect(
      findUseAsTitleField(
        config([
          { type: 'row', fields: [other] },
          { type: 'collapsible', label: 'Empty', fields: [] },
          { type: 'group', fields: [{ type: 'row', fields: [title] }] },
        ]),
      ),
    ).toEqual({ titleFieldName: 'name', localized: true })
  })
  it('should reject named nesting and a genuinely missing title', () => {
    for (const fields of [
      [],
      [{ name: 'nested', type: 'group', fields: [title] }],
      [{ type: 'tabs', tabs: [{ name: 'nested', fields: [title] }] }],
    ] as Field[][]) {
      expect(() => findUseAsTitleField(config(fields))).toThrow('was not found')
      expect(findFieldByName(config(fields), 'name')).toBeUndefined()
    }
  })
  it('should keep the default ID title', () => {
    expect(findUseAsTitleField({ slug: 'sections', fields: [] })).toEqual({
      titleFieldName: 'id',
      localized: false,
    })
  })
})
