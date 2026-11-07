import type { Payload } from 'payload'

import { EventEmitter } from 'node:events'
import { setImmediate } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'

import { postgresAdapter } from './index.js'

function createAdapter() {
  const original = new Error('Connection refused by test driver')
  const payload = { config: {}, logger: { error: vi.fn(), info: vi.fn() } } as unknown as Payload
  const adapter = postgresAdapter({
    disableCreateDatabase: true,
    migrationDir: '/tmp/payload-pg-connection-tests',
    pool: {},
    push: false,
    pg: {
      Pool: class extends EventEmitter {
        connect() {
          return Promise.reject(original)
        }
      },
    } as never,
  }).init({ payload })

  return { adapter, original }
}

describe('postgres initialization failures (#18656)', () => {
  it('should reject waiting callers with the same connection error and cause', async () => {
    const { adapter, original } = createAdapter()
    const waiting = adapter.initializing.catch((error: unknown) => error)
    const failure = await adapter.connect!().catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).cause).toBe(original)
    expect(await waiting).toBe(failure)
  })

  it.each([false, true])(
    'should avoid orphan rejections when no transaction awaits initialization (after destroy: %s)',
    async (afterDestroy) => {
      const { adapter } = createAdapter()
      if (afterDestroy) await adapter.destroy!()
      const unhandled: unknown[] = []
      const listener = (error: unknown) => unhandled.push(error)
      process.on('unhandledRejection', listener)
      try {
        await expect(adapter.connect!()).rejects.toThrow('cannot connect to Postgres')
        await setImmediate()
        await setImmediate()
        expect(unhandled).toEqual([])
      } finally {
        process.off('unhandledRejection', listener)
        await adapter.initializing.catch(() => undefined)
      }
    },
  )
})

describe('idle pool errors (#16939)', () => {
  it.each([false, true])(
    'should log idle connection termination without throwing (replicas: %s)',
    async (hasReplicas) => {
      const pools: EventEmitter[] = []
      const error = vi.fn()
      const adapter = postgresAdapter({
        pool: {},
        push: false,
        ...(hasReplicas ? { readReplicas: ['postgres://replica/test'] } : {}),
        pg: {
          Pool: class extends EventEmitter {
            constructor() {
              super()
              pools.push(this)
            }
            connect() {
              const client = new EventEmitter()
              return Promise.resolve(Object.assign(client, { release: vi.fn() }))
            }
          },
        } as never,
      }).init({ payload: { config: {}, logger: { error, info: vi.fn() } } as unknown as Payload })
      adapter.createExtensions = vi.fn().mockResolvedValue(undefined)
      await adapter.connect!()
      const failure = Object.assign(
        new Error('terminating connection due to administrator command'),
        { code: '57P01' },
      )
      for (const pool of pools) {
        expect(() => pool.emit('error', failure)).not.toThrow()
        expect(pool.listenerCount('error')).toBe(1)
      }
      expect(pools).toHaveLength(hasReplicas ? 2 : 1)
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ err: failure }))
    },
  )
})
