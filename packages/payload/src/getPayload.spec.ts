import type { Payload, SanitizedConfig } from './index.js'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayload } from './index.js'

describe('getPayload reload failures', () => {
  const keys: string[] = []
  const config = {
    admin: { importMap: { autoGenerate: false } },
    blocks: [],
    collections: [],
    globals: [],
    typescript: { autoGenerate: false },
  } as unknown as SanitizedConfig

  function createCachedInstance() {
    const key = `reload-regression-${keys.length}`
    const payload = {
      collections: {},
      db: { init: vi.fn(), connect: vi.fn() },
    } as unknown as Payload
    const cached = {
      initializedCrons: true,
      payload,
      promise: null,
      reload: true as boolean | Promise<void>,
    }

    keys.push(key)
    ;(globalThis as any)._payload.set(key, cached)

    return { cached, key, payload }
  }

  beforeEach(() => {
    for (const key of [
      '_payload_clientConfigs',
      '_payload_schemaMap',
      '_payload_clientSchemaMap',
      '_payload_doNotCacheClientConfig',
      '_payload_doNotCacheSchemaMap',
      '_payload_doNotCacheClientSchemaMap',
    ]) {
      vi.stubGlobal(key, (globalThis as any)[key])
    }
  })

  afterEach(() => {
    for (const key of keys) {
      ;(globalThis as any)._payload.delete(key)
    }
    keys.length = 0
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it.each(['config', 'reload'])(
    'should reject all waiting callers and allow a retry after a %s failure',
    async (stage) => {
      const { cached, key, payload } = createCachedInstance()
      const error = new Error('controlled reload failure')

      if (stage === 'reload') {
        vi.mocked(payload.db.init).mockRejectedValueOnce(error)
      }

      const options = { config: stage === 'config' ? Promise.reject(error) : config, key }
      const first = getPayload(options)
      const second = getPayload(options)

      await expect(Promise.all([first, second])).rejects.toBe(error)
      await expect(second).rejects.toBe(error)
      expect(cached.reload).toBe(true)
      await expect(getPayload({ config, key })).resolves.toBe(payload)
      expect(cached.reload).toBe(false)
    },
  )

  it('should share one successful reload between concurrent callers', async () => {
    const { key, payload } = createCachedInstance()

    await expect(
      Promise.all([getPayload({ config, key }), getPayload({ config, key })]),
    ).resolves.toEqual([payload, payload])
    expect(payload.db.init).toHaveBeenCalledOnce()
    expect(payload.db.connect).toHaveBeenCalledOnce()
  })
  it('should queue a change reported during an active reload (#19053)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { cached, key, payload } = createCachedInstance()
    let notify: () => void
    const strategy = {
      connect: (callback: () => void) => {
        notify = callback
        return () => {}
      },
    }
    let resolveConfig: (value: SanitizedConfig) => void
    const pendingConfig = new Promise<SanitizedConfig>((resolve) => {
      resolveConfig = resolve
    })
    const first = getPayload({ config: pendingConfig, devReloadStrategy: strategy, key })
    const waiting = getPayload({ config: pendingConfig, devReloadStrategy: strategy, key })

    notify!()
    notify!()
    resolveConfig!(config)
    await Promise.all([first, waiting])
    expect(cached.reload).toBe(true)
    await getPayload({ config, devReloadStrategy: strategy, key })
    expect(payload.db.init).toHaveBeenCalledTimes(2)
    expect(cached.reload).toBe(false)
  })
})
