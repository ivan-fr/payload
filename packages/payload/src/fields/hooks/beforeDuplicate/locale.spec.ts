import type { PayloadRequest, SanitizedCollectionConfig } from '../../../index.js'

import { describe, expect, it, vi } from 'vitest'

import { beforeDuplicate } from './index.js'

describe('beforeDuplicate hook locales (#17021)', () => {
  it('should expose each locale without changing the original Request', async () => {
    const hooks: string[] = []
    const hook = vi.fn(async ({ req, value }) => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      hooks.push(req.locale)
      expect(req.headers.get('x-fixture')).toBe('retained')
      return `${value}-${req.locale}`
    })
    const collection = {
      fields: [
        { name: 'title', type: 'text', localized: true, hooks: { beforeDuplicate: [hook] } },
        {
          name: 'rows',
          type: 'array',
          localized: true,
          fields: [{ name: 'text', type: 'text', hooks: { beforeDuplicate: [hook] } }],
        },
      ],
    } as unknown as SanitizedCollectionConfig
    const req = Object.assign(
      new Request('http://localhost', { headers: { 'x-fixture': 'retained' } }),
      {
        locale: 'en',
        payload: { config: { localization: { localeCodes: ['en', 'fr'] } } },
      },
    ) as unknown as PayloadRequest
    const doc = {
      title: { en: 'Hello', fr: 'Bonjour' },
      rows: { en: [{ text: 'Row' }], fr: [{ text: 'Ligne' }] },
    }

    await beforeDuplicate({ collection, context: {}, doc, overrideAccess: true, req })
    expect(doc.title).toEqual({ en: 'Hello-en', fr: 'Bonjour-fr' })
    expect(doc.rows).toEqual({ en: [{ text: 'Row-en' }], fr: [{ text: 'Ligne-fr' }] })
    expect(hooks.sort()).toEqual(['en', 'en', 'fr', 'fr'])
    expect(req.locale).toBe('en')
  })
})
