import type { I18nClient } from '@payloadcms/translations'
import type { ClientCollectionConfig, ClientConfig } from 'payload'

import { describe, expect, it } from 'vitest'

import { getRelationshipIDsToLoad } from './getRelationshipIDsToLoad.js'
import { findOptionsByValue } from './findOptionsByValue.js'
import { optionsReducer } from './optionsReducer.js'

const collection = {
  slug: 'categories',
  admin: { useAsTitle: 'title' },
  labels: { plural: 'Categories' },
  fields: [{ name: 'title', type: 'text' }],
} as unknown as ClientCollectionConfig
const config = { admin: {} } as ClientConfig
const i18n = {
  language: 'en',
  fallbackLanguage: 'en',
  t: () => 'Untitled',
} as unknown as I18nClient

describe('selected relationship recovery (#17425)', () => {
  it('should replace a failed-load placeholder when the real document arrives without changing field edit permissions', () => {
    const failed = optionsReducer([], { type: 'ADD', collection, config, i18n, docs: [], ids: [0] })
    expect(getRelationshipIDsToLoad({ ids: [0], options: failed, relation: 'categories' })).toEqual(
      [0],
    )
    const recovered = optionsReducer(failed, {
      type: 'ADD',
      collection,
      config,
      i18n,
      docs: [{ id: 0, title: 'Recovered category' }],
      ids: [0],
      sort: true,
    })
    const selected = findOptionsByValue({
      allowEdit: false,
      options: recovered,
      value: { relationTo: 'categories', value: 0 },
    })

    expect(
      getRelationshipIDsToLoad({ ids: [0], options: recovered, relation: 'categories' }),
    ).toEqual([])
    expect(recovered[0].options).toHaveLength(1)
    expect(selected).toMatchObject({
      label: 'Recovered category',
      allowEdit: false,
      doc: { id: 0 },
    })
    expect(failed[0].options[0].label).toBe('Untitled - ID: 0')
  })

  it('should retain real records, unrelated collection placeholders and duplicate-free results', () => {
    const failed = optionsReducer([], {
      type: 'ADD',
      collection,
      config,
      i18n,
      docs: [],
      ids: ['a'],
    })
    const otherCollection = { ...collection, slug: 'other', labels: { plural: 'Other' } }
    const twoGroups = optionsReducer(failed, {
      type: 'ADD',
      collection: otherCollection,
      config,
      i18n,
      docs: [],
      ids: ['a'],
    })
    const recovered = optionsReducer(twoGroups, {
      type: 'ADD',
      collection,
      config,
      i18n,
      docs: [
        { id: 'a', title: 'Title' },
        { id: 'a', title: 'Duplicate' },
      ],
    })

    expect(recovered[0].options).toHaveLength(1)
    expect(recovered[0].options[0].label).toBe('Title')
    expect(recovered[1].options[0].label).toBe('Untitled - ID: a')
  })
})
