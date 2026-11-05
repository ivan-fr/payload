import type { ClientCollectionConfig, ClientConfig } from 'payload'
import type { I18nClient } from '@payloadcms/translations'

import { describe, expect, it } from 'vitest'

import { optionsReducer } from './optionsReducer.js'

const config = { admin: {} } as ClientConfig
const collection = {
  slug: 'posts',
  admin: { useAsTitle: 'title' },
  labels: { plural: { en: 'Posts', fr: 'Articles' } },
  fields: [{ name: 'title', type: 'text' }],
} as unknown as ClientCollectionConfig

describe('localized relationship option groups (#17758)', () => {
  for (const language of ['en', 'fr']) {
    const i18n = {
      language,
      fallbackLanguage: 'en',
      t: (key: string) => key,
    } as unknown as I18nClient
    it(`should add, update and remove options in one ${language} group`, () => {
      const first = optionsReducer([], {
        type: 'ADD',
        collection,
        config,
        i18n,
        docs: [{ id: '1', title: 'First' }],
      })
      const second = optionsReducer(first, {
        type: 'ADD',
        collection,
        config,
        i18n,
        docs: [{ id: '2', title: 'Second' }],
      })
      expect(second).toHaveLength(1)
      expect(second[0]!.label).toBe(language === 'en' ? 'Posts' : 'Articles')
      expect(second[0]!.options).toHaveLength(2)
      const renamed = optionsReducer(second, {
        type: 'UPDATE',
        collection,
        config,
        i18n,
        doc: { id: '2', title: 'Renamed' },
      })
      expect(renamed[0]!.options[1]!.label).toBe('Renamed')
      const removed = optionsReducer(renamed, { type: 'REMOVE', collection, config, i18n, id: '1' })
      expect(removed[0]!.options.map((option) => option.value)).toEqual(['2'])
    })
  }
})
