import type { SupportedLanguages } from '@payloadcms/translations'
import type { ClientConfig, CreateClientConfigArgs } from 'payload'

import { createClientConfig, createUnauthenticatedClientConfig } from 'payload'
import { cache } from 'react'

type CachedClientConfigs = Record<keyof SupportedLanguages, ClientConfig>

type GetClientConfigArgs = {
  user: CreateClientConfigArgs['user'] | null
} & Omit<CreateClientConfigArgs, 'user'>

let configsBySource = new WeakMap<GetClientConfigArgs['config'], CachedClientConfigs>()

export const getClientConfig = cache(
  ({ config, i18n, importMap, user }: GetClientConfigArgs): ClientConfig => {
    if (global._payload_doNotCacheClientConfig) {
      configsBySource = new WeakMap()
      global._payload_doNotCacheClientConfig = false
    }
    let cachedClientConfigs = configsBySource.get(config)
    if (!cachedClientConfigs) {
      cachedClientConfigs = {} as CachedClientConfigs
      configsBySource.set(config, cachedClientConfigs)
    }
    const currentLanguage = i18n.language

    if (cachedClientConfigs[currentLanguage]) {
      if (!user) {
        return createUnauthenticatedClientConfig({
          clientConfig: cachedClientConfigs[currentLanguage],
        }) as unknown as ClientConfig
      }

      return cachedClientConfigs[currentLanguage]
    }

    const cachedClientConfig = createClientConfig({
      config,
      i18n,
      importMap,
      // Always cache the full config, then return its redacted version for unauthenticated users.
      user: true,
    })

    cachedClientConfigs[currentLanguage] = cachedClientConfig
    global._payload_clientConfigs = cachedClientConfigs
    global._payload_doNotCacheClientConfig = false

    if (!user) {
      return createUnauthenticatedClientConfig({
        clientConfig: cachedClientConfig,
      }) as unknown as ClientConfig
    }

    return cachedClientConfig
  },
)
