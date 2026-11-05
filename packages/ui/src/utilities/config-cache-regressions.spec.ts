import type { I18nClient } from '@payloadcms/translations'
import type { ClientConfig, Payload, SanitizedConfig } from 'payload'

import { afterEach, describe, expect, it } from 'vitest'

import { getClientConfig } from './getClientConfig.js'
import { getClientSchemaMap } from './getClientSchemaMap.js'
import { getSchemaMap } from './getSchemaMap.js'

const i18n = { language: 'en', t: (key: string) => key } as unknown as I18nClient
const createConfig = ({ hasSummary = false } = {}) =>
  ({
    admin: { routes: {}, user: 'pages' },
    blocks: [],
    collections: [
      {
        slug: 'pages',
        fields: [
          { name: 'title', type: 'text' },
          ...(hasSummary ? [{ name: 'summary', type: 'text' }] : []),
        ],
      },
    ],
    db: { defaultIDType: 'number' },
    globals: [],
  }) as unknown as SanitizedConfig
const payload = { config: { db: { defaultIDType: 'number' } }, importMap: {} } as unknown as Payload

afterEach(() => {
  global._payload_doNotCacheClientConfig = true
  global._payload_doNotCacheSchemaMap = true
  global._payload_doNotCacheClientSchemaMap = true
})

describe('config caches after development reload', () => {
  it('should isolate client configs even when a previous-config request arrives after invalidation', () => {
    const oldConfig = createConfig()
    const newConfig = createConfig({ hasSummary: true })
    const read = (config: SanitizedConfig, user: true | null = true) =>
      getClientConfig({ config, i18n, importMap: {}, user })
    const oldClient = read(oldConfig)
    global._payload_doNotCacheClientConfig = true
    read(oldConfig)
    const newClient = read(newConfig)

    expect(
      newClient.collections[0].fields.some((field) => 'name' in field && field.name === 'summary'),
    ).toBe(true)
    expect(read(newConfig)).toBe(newClient)
    expect(read(oldConfig).collections[0].fields).toEqual(oldClient.collections[0].fields)
    expect(read(newConfig, null)).toMatchObject({
      unauthenticated: true,
      collections: [{ slug: 'pages' }],
    })
    expect(read(newConfig, null).collections[0]).not.toHaveProperty('fields')
    expect(read(newConfig)).toBe(newClient)
  })

  it('should isolate field maps across config generations and preserve same-config reuse', () => {
    const oldConfig = createConfig()
    const newConfig = createConfig({ hasSummary: true })
    const read = (config: SanitizedConfig) =>
      getSchemaMap({ config, i18n, collectionSlug: 'pages' })
    read(oldConfig)
    global._payload_doNotCacheSchemaMap = true
    read(oldConfig)
    const next = read(newConfig)

    expect(next.has('pages.summary')).toBe(true)
    expect(read(oldConfig).has('pages.summary')).toBe(false)
    expect(read(newConfig)).toBe(next)
  })

  it('should isolate client field maps across client config generations', () => {
    const oldConfig = createConfig() as unknown as ClientConfig
    const newConfig = createConfig({ hasSummary: true }) as unknown as ClientConfig
    const schemaMap = new Map()
    const read = (config: ClientConfig) =>
      getClientSchemaMap({ config, i18n, collectionSlug: 'pages', payload, schemaMap })
    read(oldConfig)
    global._payload_doNotCacheClientSchemaMap = true
    read(oldConfig)
    const next = read(newConfig)

    expect(next.has('pages.summary')).toBe(true)
    expect(read(oldConfig).has('pages.summary')).toBe(false)
    expect(read(newConfig)).toBe(next)
  })
})

describe('schema cache boundaries', () => {
  it('should preserve auth field translations when another language map is built', () => {
    const config = createConfig()
    config.collections[0]!.auth = {} as never
    const english = { language: 'en', t: (key: string) => `en:${key}` } as unknown as I18nClient
    const french = { language: 'fr', t: (key: string) => `fr:${key}` } as unknown as I18nClient
    const enMap = getSchemaMap({ config, i18n: english, collectionSlug: 'pages' })
    const frMap = getSchemaMap({ config, i18n: french, collectionSlug: 'pages' })

    expect(enMap.get('pages.password')).toMatchObject({ label: 'en:general:password' })
    expect(frMap.get('pages.password')).toMatchObject({ label: 'fr:general:password' })
    expect(getSchemaMap({ config, i18n: english, collectionSlug: 'pages' })).toBe(enMap)
  })

  it('should honor explicit invalidation for the same config objects', () => {
    const config = createConfig()
    const client = getClientConfig({ config, i18n, importMap: {}, user: true })
    const map = getSchemaMap({ config, i18n, collectionSlug: 'pages' })
    const clientMap = getClientSchemaMap({
      config: client,
      i18n,
      collectionSlug: 'pages',
      payload,
      schemaMap: map,
    })
    global._payload_doNotCacheClientConfig = true
    global._payload_doNotCacheSchemaMap = true
    global._payload_doNotCacheClientSchemaMap = true

    expect(getClientConfig({ config, i18n, importMap: {}, user: true })).not.toBe(client)
    expect(getSchemaMap({ config, i18n, collectionSlug: 'pages' })).not.toBe(map)
    expect(
      getClientSchemaMap({
        config: client,
        i18n,
        collectionSlug: 'pages',
        payload,
        schemaMap: map,
      }),
    ).not.toBe(clientMap)
  })

  it('should rebuild a client map when its server schema map is replaced', () => {
    const config = createConfig() as unknown as ClientConfig
    const schemaMap = new Map()
    const previous = getClientSchemaMap({
      config,
      i18n,
      collectionSlug: 'pages',
      payload,
      schemaMap,
    })
    const next = getClientSchemaMap({
      config,
      i18n,
      collectionSlug: 'pages',
      payload,
      schemaMap: new Map(),
    })

    expect(next).not.toBe(previous)
    expect(getClientSchemaMap({ config, i18n, collectionSlug: 'pages', payload, schemaMap })).toBe(
      previous,
    )
  })
})
