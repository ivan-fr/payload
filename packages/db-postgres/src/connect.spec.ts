import type { Payload } from 'payload'

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
      Pool: class {
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
