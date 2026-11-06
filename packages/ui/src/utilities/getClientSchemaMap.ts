import type { I18n, I18nClient } from '@payloadcms/translations'
import type { ClientConfig, ClientFieldSchemaMap, FieldSchemaMap, Payload } from 'payload'

import { cache } from 'react'

import { buildClientFieldSchemaMap } from './buildClientFieldSchemaMap/index.js'

let mapsByConfig = new WeakMap<
  ClientConfig,
  WeakMap<FieldSchemaMap, Map<string, ClientFieldSchemaMap>>
>()

export const getClientSchemaMap = cache(
  (args: {
    collectionSlug?: string
    config: ClientConfig
    globalSlug?: string
    i18n: I18nClient
    payload: Payload
    schemaMap: FieldSchemaMap
    widgetSlug?: string
  }): ClientFieldSchemaMap => {
    const { collectionSlug, config, globalSlug, i18n, payload, schemaMap, widgetSlug } = args

    if (global._payload_doNotCacheClientSchemaMap) {
      mapsByConfig = new WeakMap()
      global._payload_doNotCacheClientSchemaMap = false
    }
    let mapsBySchema = mapsByConfig.get(config)
    if (!mapsBySchema) {
      mapsBySchema = new WeakMap()
      mapsByConfig.set(config, mapsBySchema)
    }
    let cachedClientSchemaMap = mapsBySchema.get(schemaMap)
    if (!cachedClientSchemaMap) {
      cachedClientSchemaMap = new Map()
      mapsBySchema.set(schemaMap, cachedClientSchemaMap)
    }

    // Labels are translated while building the map, so it has to be cached per language
    let entityKey = `widget:${widgetSlug}`
    if (collectionSlug) {
      entityKey = `collection:${collectionSlug}`
    } else if (globalSlug) {
      entityKey = `global:${globalSlug}`
    }
    const cacheKey = `${i18n.language}:${entityKey}`
    const cachedEntityClientFieldMap = cachedClientSchemaMap.get(cacheKey)

    if (cachedEntityClientFieldMap) {
      return cachedEntityClientFieldMap
    }

    const { clientFieldSchemaMap: entityClientFieldMap } = buildClientFieldSchemaMap({
      collectionSlug,
      config,
      globalSlug,
      i18n: i18n as I18n,
      payload,
      schemaMap,
      widgetSlug,
    })

    cachedClientSchemaMap.set(cacheKey, entityClientFieldMap)

    global._payload_clientSchemaMap = cachedClientSchemaMap

    global._payload_doNotCacheClientSchemaMap = false

    return entityClientFieldMap
  },
)
