import type { I18n, I18nClient } from '@payloadcms/translations'
import type { FieldSchemaMap, SanitizedConfig } from 'payload'

import { cache } from 'react'

import { buildFieldSchemaMap } from './buildFieldSchemaMap/index.js'

let mapsByConfig = new WeakMap<SanitizedConfig, Map<string, FieldSchemaMap>>()

export const getSchemaMap = cache(
  (args: {
    collectionSlug?: string
    config: SanitizedConfig
    globalSlug?: string
    i18n: I18nClient
    widgetSlug?: string
  }): FieldSchemaMap => {
    const { collectionSlug, config, globalSlug, i18n, widgetSlug } = args

    if (global._payload_doNotCacheSchemaMap) {
      mapsByConfig = new WeakMap()
      global._payload_doNotCacheSchemaMap = false
    }
    let cachedSchemaMap = mapsByConfig.get(config)
    if (!cachedSchemaMap) {
      cachedSchemaMap = new Map()
      mapsByConfig.set(config, cachedSchemaMap)
    }

    let entityKey = `widget:${widgetSlug}`
    if (collectionSlug) {
      entityKey = `collection:${collectionSlug}`
    } else if (globalSlug) {
      entityKey = `global:${globalSlug}`
    }
    const cacheKey = `${i18n.language}:${entityKey}`
    const cachedEntityFieldMap = cachedSchemaMap.get(cacheKey)

    if (cachedEntityFieldMap) {
      return cachedEntityFieldMap
    }

    const { fieldSchemaMap: entityFieldMap } = buildFieldSchemaMap({
      collectionSlug,
      config,
      globalSlug,
      i18n: i18n as I18n,
      widgetSlug,
    })

    cachedSchemaMap.set(cacheKey, entityFieldMap)

    global._payload_schemaMap = cachedSchemaMap

    global._payload_doNotCacheSchemaMap = false

    return entityFieldMap
  },
)
