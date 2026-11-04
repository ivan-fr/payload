import type { DrizzleAdapter } from './types.js'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ read: vi.fn(), commit: vi.fn(), rollback: vi.fn() }))
vi.mock('payload', async (original) => ({
  ...(await original<typeof import('payload')>()),
  readMigrationFiles: mocks.read,
  createPayloadRequest: async ({ payload }: { payload: unknown }) => ({ payload, context: {} }),
  initTransaction: async () => false,
  commitTransaction: mocks.commit,
  killTransaction: mocks.rollback,
}))
vi.mock('./utilities/migrationTableExists.js', () => ({ migrationTableExists: async () => true }))

import { migrateReset } from './migrateReset.js'

beforeEach(() => {
  vi.clearAllMocks()
})

const fixture = () => {
  const migrations = [
    { id: 3, batch: 2, name: '003' },
    { id: 2, batch: 1, name: '002' },
    { id: 1, batch: 1, name: '001' },
  ]
  const adapter = {
    drizzle: {},
    payload: {
      find: vi.fn(async () => ({ docs: migrations })),
      delete: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    },
  } as unknown as DrizzleAdapter
  return { adapter, migrations }
}

describe('migration reset order (#15334)', () => {
  it('should undo descending batches and names without reversing or mutating the database order', async () => {
    const { adapter, migrations } = fixture()
    const order: string[] = []
    mocks.read.mockResolvedValue(
      ['001', '002', '003'].map((name) => ({
        name,
        down: async () => {
          order.push(name)
        },
      })),
    )
    expect(await migrateReset.call(adapter)).toEqual({
      migrated: [],
      rolledBack: ['003', '002', '001'],
    })
    expect(order).toEqual(['003', '002', '001'])
    expect(migrations.map((m) => m.name)).toEqual(['003', '002', '001'])
    expect(adapter.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ sort: ['-batch', '-name'] }),
    )
    expect(mocks.commit).toHaveBeenCalledTimes(3)
  })

  it('should stop and roll back on the first failed down migration', async () => {
    const { adapter } = fixture()
    const failure = new Error('cannot undo newest migration')
    const older = vi.fn()
    mocks.read.mockResolvedValue([
      {
        name: '003',
        down: async () => {
          throw failure
        },
      },
      { name: '002', down: older },
      { name: '001', down: older },
    ])
    await expect(migrateReset.call(adapter)).rejects.toBe(failure)
    expect(older).not.toHaveBeenCalled()
    expect(mocks.rollback).toHaveBeenCalledTimes(1)
    expect(mocks.commit).not.toHaveBeenCalled()
  })

  it('should retain the missing-migration diagnostic', async () => {
    const { adapter } = fixture()
    mocks.read.mockResolvedValue([])
    await expect(migrateReset.call(adapter)).rejects.toThrow('Migration 003 not found locally.')
  })
})
