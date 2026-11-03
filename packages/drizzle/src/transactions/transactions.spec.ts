import type { DrizzleAdapter } from '../types.js'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@libsql/client'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { describe, expect, it, vi } from 'vitest'

import { beginTransaction } from './beginTransaction.js'
import { commitTransaction } from './commitTransaction.js'
import { rollbackTransaction } from './rollbackTransaction.js'

function createAdapter({
  commitError,
  connectionError,
}: { commitError?: unknown; connectionError?: Error } = {}) {
  const tx = {}
  const adapter = {
    drizzle: {
      transaction: vi.fn(async (callback) => {
        // Drizzle acquires a connection asynchronously before invoking its callback.
        await Promise.resolve()

        if (connectionError) {
          throw connectionError
        }

        await callback(tx)

        if (commitError !== undefined) {
          throw commitError
        }
      }),
    },
    payload: { logger: { error: vi.fn() } },
    sessions: {},
  } as unknown as DrizzleAdapter

  return { adapter, tx }
}

describe('Drizzle transaction lifecycle', () => {
  it('should reject a real deferred foreign key failure at commit', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'payload-commit-regression-'))
    const client = createClient({ url: pathToFileURL(path.join(directory, 'test.db')).href })
    const db = drizzle(client)
    const adapter = {
      drizzle: db,
      payload: { logger: { error: vi.fn() } },
      sessions: {},
    } as unknown as DrizzleAdapter

    try {
      await db.run(sql`PRAGMA foreign_keys = ON`)
      await db.run(sql`CREATE TABLE parents (id INTEGER PRIMARY KEY)`)
      await db.run(
        sql`CREATE TABLE children (parent_id INTEGER REFERENCES parents(id) DEFERRABLE INITIALLY DEFERRED)`,
      )

      const id = await beginTransaction.call(adapter)
      const tx = adapter.sessions[id].db as typeof db

      await tx.run(sql`INSERT INTO children VALUES (99)`)
      await expect(commitTransaction.call(adapter, id)).rejects.toThrow(/foreign key/i)
      expect(adapter.sessions[id]).toBeUndefined()
      expect(await db.all(sql`SELECT * FROM children`)).toEqual([])
    } finally {
      client.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('should commit successfully and remove the session', async () => {
    const { adapter, tx } = createAdapter()
    const id = await beginTransaction.call(adapter)

    expect(adapter.sessions[id].db).toBe(tx)
    await expect(commitTransaction.call(adapter, id)).resolves.toBeUndefined()
    expect(adapter.sessions[id]).toBeUndefined()
  })

  it('should propagate a refused commit and remove the session', async () => {
    const error = new Error('deferred unique constraint failed')
    const { adapter } = createAdapter({ commitError: error })
    const id = await beginTransaction.call(adapter)

    await expect(commitTransaction.call(adapter, id)).rejects.toBe(error)
    expect(adapter.sessions[id]).toBeUndefined()
  })

  it('should roll back without exposing the intentional callback rejection', async () => {
    const { adapter } = createAdapter()
    const id = await beginTransaction.call(adapter)

    await expect(rollbackTransaction.call(adapter, id)).resolves.toBeUndefined()
    expect(adapter.sessions[id]).toBeUndefined()
    await expect(rollbackTransaction.call(adapter, id)).resolves.toBeUndefined()
  })

  it('should preserve the commit error if cleanup also fails', async () => {
    const error = new Error('commit failed')
    const { adapter } = createAdapter()

    adapter.sessions.test = {
      db: {} as DrizzleAdapter['sessions'][string]['db'],
      reject: vi.fn().mockRejectedValue(new Error('cleanup failed')),
      resolve: vi.fn().mockRejectedValue(error),
    }

    await expect(commitTransaction.call(adapter, 'test')).rejects.toBe(error)
    expect(adapter.sessions.test).toBeUndefined()
  })

  it('should reject a connection failure before the callback starts', async () => {
    const { adapter } = createAdapter({ connectionError: new Error('connection refused') })

    await expect(beginTransaction.call(adapter)).rejects.toThrow('connection refused')
    expect(adapter.sessions).toEqual({})
  })
})
