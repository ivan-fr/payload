import { describe, expect, it } from 'vitest'

import { translations as languages } from './exports/all.js'
import { clientTranslationKeys } from './clientKeys.js'

describe('load-more translations (#18875)', () => {
  it.each(Object.entries(languages))(
    'should retain both count placeholders in %s',
    (_name, language) => {
      const message = language.translations.general.showingCurrentOfTotal

      expect(message.trim()).not.toBe('')
      expect([...message.matchAll(/{{(.*?)}}/g)].map((match) => match[1]).sort()).toEqual([
        'current',
        'total',
      ])
    },
  )

  it('should expose the count message to client translations', () => {
    expect(clientTranslationKeys).toContain('general:showingCurrentOfTotal')
  })
})
