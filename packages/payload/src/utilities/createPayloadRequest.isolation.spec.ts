import type { Payload, PayloadRequest } from '../index.js'

import { describe, expect, it, vi } from 'vitest'

import { createPayloadRequest } from './createPayloadRequest.js'

const payload = {
  config: {
    admin: { user: 'users' },
    i18n: { fallbackLanguage: 'en', supportedLanguages: { en: {} }, translations: {} },
    localization: {
      defaultLocale: 'en',
      fallback: true,
      localeCodes: ['en', 'fr', 'de'],
      locales: ['en', 'fr', 'de'],
    },
  },
  logger: { error: vi.fn() },
} as unknown as Payload

describe('nested request locale/depth isolation (#18844)', () => {
  it('should isolate explicit overrides and the loader while preserving native headers and transaction sharing', async () => {
    const parent = Object.assign(
      new Request('https://cms.example/api/posts', { headers: { 'x-request': 'kept' } }),
      {
        locale: 'fr',
        fallbackLocale: 'de',
        query: { depth: 3, custom: 'kept' },
        transactionID: 'tx',
        user: { id: 'u', collection: 'users' },
        context: {},
      },
    ) as unknown as PayloadRequest
    await createPayloadRequest({ payload, req: parent })
    const originalLoader = parent.payloadDataLoader
    const nested = await createPayloadRequest({
      payload,
      req: parent,
      locale: 'en',
      fallbackLocale: false,
      depth: 0,
    })

    expect(nested.locale).toBe('en')
    expect(nested.fallbackLocale).toBe(false)
    expect(nested.query.depth).toBe(0)
    expect(nested.headers.get('x-request')).toBe('kept')
    expect(nested.user).toBe(parent.user)
    expect(nested.transactionID).toBe('tx')
    expect(nested.payloadDataLoader).not.toBe(originalLoader)
    expect(parent.payloadDataLoader).toBe(originalLoader)
    expect(parent.locale).toBe('fr')
    expect(parent.fallbackLocale).toBe('de')
    expect(parent.query).toEqual({ depth: 3, custom: 'kept' })
    nested.transactionID = 'nested-tx'
    expect(parent.transactionID).toBe('nested-tx')
  })

  it('should preserve native body methods on a scoped Request', async () => {
    const parent = Object.assign(
      new Request('https://cms.example/api/posts', {
        method: 'POST',
        body: JSON.stringify({ title: 'Kept' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { locale: 'fr' },
    )
    const nested = await createPayloadRequest({ payload, req: parent, locale: 'en' })

    expect(nested.json).toBe(nested.json)
    expect(await nested.json()).toEqual({ title: 'Kept' })
    expect(parent.bodyUsed).toBe(true)
    expect(parent.locale).toBe('fr')
  })

  it('should retain normal request and loader reuse when no scope changes', async () => {
    const parent = await createPayloadRequest({ payload, locale: 'fr' })
    const loader = parent.payloadDataLoader
    const nested = await createPayloadRequest({
      payload,
      req: parent,
      locale: 'fr',
      fallbackLocale: parent.fallbackLocale as 'en',
    })

    expect(nested).toBe(parent)
    expect(nested.payloadDataLoader).toBe(loader)
  })
})
