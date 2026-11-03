import type { SyncDocArgs } from '../types.js'

import { describe, expect, it, vi } from 'vitest'

import { syncDocAsSearchIndex } from './syncDocAsSearchIndex.js'

const fixture = ({
  operation = 'create',
  found = false,
  transactionID,
}: {
  operation?: 'create' | 'update'
  found?: boolean
  transactionID?: number | string | Promise<null | number | string>
} = {}) => {
  const failure = new Error('search write failed')
  const payload = {
    config: {},
    logger: { error: vi.fn() },
    create: vi.fn().mockRejectedValue(failure),
    update: vi.fn().mockRejectedValue(failure),
    delete: vi.fn().mockRejectedValue(failure),
    find: vi.fn().mockResolvedValue({ docs: found ? [{ id: 5 }] : [] }),
  }
  const args = {
    collection: 'posts',
    doc: { id: 1, title: 'Post', _status: 'published' },
    operation,
    pluginConfig: { collections: ['posts'], syncDrafts: false, deleteDrafts: true },
    req: { payload, context: {}, transactionID },
  } as unknown as SyncDocArgs
  return { args, payload, failure }
}

describe('search write failures (#17699)', () => {
  it.each([
    { operation: 'create' as const },
    { operation: 'update' as const },
    { operation: 'update' as const, found: true },
  ])('should reject failed index creates/updates with the original error: %o', async (options) => {
    const { args, failure } = fixture(options)
    await expect(syncDocAsSearchIndex(args)).rejects.toBe(failure)
  })

  it('should report standalone reindex failures through the explicit callback', async () => {
    const { args } = fixture()
    const onSyncError = vi.fn()
    await syncDocAsSearchIndex({ ...args, onSyncError })
    expect(onSyncError).toHaveBeenCalledOnce()
  })

  it('should never swallow a shared-transaction failure even with a callback', async () => {
    const { args, failure } = fixture({ transactionID: 'parent-transaction' })
    const onSyncError = vi.fn()
    await expect(syncDocAsSearchIndex({ ...args, onSyncError })).rejects.toBe(failure)
    expect(onSyncError).toHaveBeenCalledOnce()
  })

  it('should return the parent document after a successful index write', async () => {
    const { args, payload } = fixture()
    payload.create.mockResolvedValue({ id: 5 })
    expect(await syncDocAsSearchIndex(args)).toBe(args.doc)
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ req: args.req }))
  })
  it.each(['duplicates', 'trash', 'draft'])(
    'should reject failed search deletions: %s',
    async (kind) => {
      const { args, payload, failure } = fixture({ operation: 'update', found: true })
      if (kind === 'duplicates')
        payload.find.mockResolvedValueOnce({ docs: [{ id: 5 }, { id: 6 }] })
      if (kind === 'trash') args.doc.deletedAt = '2026-01-01T00:00:00Z'
      if (kind === 'draft') {
        args.doc._status = 'draft'
        payload.find
          .mockResolvedValueOnce({ docs: [{ id: 5 }] })
          .mockResolvedValueOnce({ docs: [] })
      }
      await expect(syncDocAsSearchIndex(args)).rejects.toBe(failure)
      expect(payload.logger.error).toHaveBeenCalledOnce()
    },
  )

  it('should let a failed sync retry using the same request context', async () => {
    const { args, payload, failure } = fixture()
    await expect(syncDocAsSearchIndex(args)).rejects.toBe(failure)
    payload.create.mockResolvedValue({ id: 5 })
    expect(await syncDocAsSearchIndex(args)).toBe(args.doc)
    expect(payload.create).toHaveBeenCalledTimes(2)
  })
  it('should preserve standalone error collection when an inactive transaction promise exists', async () => {
    const { args } = fixture({ transactionID: Promise.resolve(null) })
    const onSyncError = vi.fn()
    await expect(syncDocAsSearchIndex({ ...args, onSyncError })).resolves.toBe(args.doc)
    expect(onSyncError).toHaveBeenCalledOnce()
  })

  it('should still reject if a nested write removes the shared transaction ID', async () => {
    const { args, payload, failure } = fixture({ transactionID: Promise.resolve('shared') })
    payload.create.mockImplementation(async () => {
      delete args.req.transactionID
      throw failure
    })
    await expect(syncDocAsSearchIndex({ ...args, onSyncError: vi.fn() })).rejects.toBe(failure)
  })
})
