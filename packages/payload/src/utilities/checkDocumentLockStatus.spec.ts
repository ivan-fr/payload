import type { PayloadRequest } from '../index.js'

import { describe, expect, it, vi } from 'vitest'

import { lockedDocumentsCollectionSlug } from '../locked-documents/config.js'
import {
  checkDocumentLockStatus,
  deleteDocumentLocks,
  getLockedDocumentIds,
} from './checkDocumentLockStatus.js'

function createRequest({
  name = 'postgres',
  docs = [],
}: { name?: string; docs?: Record<string, unknown>[] } = {}) {
  const req = { transactionID: 'held-connection', user: { id: 'me' } } as unknown as PayloadRequest
  const find = vi.fn().mockImplementation(async (args) => {
    if (name !== 'mongoose' && args.req !== req)
      throw new Error('Pool exhausted: acquire outside transaction')
    return { docs }
  })
  const deleteMany = vi.fn().mockResolvedValue(undefined)
  req.payload = {
    collections: {
      [lockedDocumentsCollectionSlug]: {},
      posts: { config: { lockDocuments: true } },
    },
    db: { name, find, deleteMany },
  } as unknown as PayloadRequest['payload']
  return { req, find, deleteMany }
}

describe('lock reads on the transaction connection (#18406)', () => {
  it('should reuse the connection for single-document lock reads and cleanup', async () => {
    const { req, find, deleteMany } = createRequest()
    await checkDocumentLockStatus({ id: 'post', collectionSlug: 'posts', overrideLock: false, req })

    expect(find).toHaveBeenCalledWith(expect.objectContaining({ req }))
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({ req }))
  })

  it('should retain the active foreign-user lock and return 423', async () => {
    const { req, deleteMany } = createRequest({
      docs: [{ updatedAt: new Date().toISOString(), user: { value: 'other' } }],
    })
    await expect(
      checkDocumentLockStatus({ id: 'post', collectionSlug: 'posts', overrideLock: false, req }),
    ).rejects.toMatchObject({ status: 423 })
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it('should reuse the connection for batched lock reads and retain only foreign locks', async () => {
    const { req } = createRequest({
      docs: [
        {
          document: { value: 'locked' },
          user: { value: 'other' },
          updatedAt: new Date().toISOString(),
        },
        { document: { value: 'mine' }, user: { value: 'me' }, updatedAt: new Date().toISOString() },
        { document: { value: 'expired' }, user: { value: 'other' }, updatedAt: '2000-01-01' },
      ],
    })
    expect(
      await getLockedDocumentIds({
        collectionSlug: 'posts',
        ids: ['locked', 'mine', 'expired'],
        overrideLock: false,
        req,
      }),
    ).toEqual(new Set(['locked']))
  })

  it('should preserve the MongoDB session exception for reads and cleanup', async () => {
    const { req, find, deleteMany } = createRequest({ name: 'mongoose' })
    await checkDocumentLockStatus({ id: 'post', collectionSlug: 'posts', overrideLock: false, req })
    await getLockedDocumentIds({ collectionSlug: 'posts', ids: ['post'], overrideLock: false, req })
    for (const [args] of find.mock.calls) expect(args.req).toBeUndefined()
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({ req: undefined }))
  })

  it('should skip lock reads when overriding locks', async () => {
    const { req, find } = createRequest()
    await checkDocumentLockStatus({ id: 'post', collectionSlug: 'posts', req })
    expect(find).not.toHaveBeenCalled()
  })
})

describe('bounded bulk lock queries (#19233)', () => {
  it('should deduplicate IDs, bound reads and deletes, and reuse the transaction request', async () => {
    const { req, find, deleteMany } = createRequest({ name: 'sqlite' })
    Object.assign(req.payload.db, { limitedBoundParameters: true })
    const ids = Array.from({ length: 90 }, (_, i) => `id-${i}`)
    const input = [...ids, ...ids]
    const original = [...input]
    await getLockedDocumentIds({ collectionSlug: 'posts', ids: input, overrideLock: false, req })
    await deleteDocumentLocks({ collectionSlug: 'posts', ids: input, req })
    expect(find).toHaveBeenCalledTimes(3)
    expect(deleteMany).toHaveBeenCalledTimes(3)
    for (const calls of [find.mock.calls, deleteMany.mock.calls]) {
      const references = calls.flatMap(([args]) => {
        expect(args.req).toBe(req)
        expect(args.where.or.length).toBeLessThanOrEqual(40)
        return args.where.or.map(({ document }) => document.equals)
      })
      expect(references).toEqual(ids.map((value) => ({ relationTo: 'posts', value })))
    }
    expect(input).toEqual(original)
  })

  it('should honor the most recent lock and skip cleanup for disabled locking or empty IDs', async () => {
    const { req, find, deleteMany } = createRequest({
      docs: [
        { document: { value: 'mine' }, user: { value: 'me' }, updatedAt: new Date().toISOString() },
        {
          document: { value: 'mine' },
          user: { value: 'other' },
          updatedAt: new Date().toISOString(),
        },
        {
          document: { value: 'foreign' },
          user: { value: 'other' },
          updatedAt: new Date().toISOString(),
        },
      ],
    })
    expect(
      await getLockedDocumentIds({
        collectionSlug: 'posts',
        ids: ['mine', 'foreign'],
        overrideLock: false,
        req,
      }),
    ).toEqual(new Set(['foreign']))
    find.mockClear()
    await deleteDocumentLocks({ collectionSlug: 'posts', ids: [], req })
    req.payload.collections.posts!.config.lockDocuments = false
    await deleteDocumentLocks({ collectionSlug: 'posts', ids: ['mine'], req })
    expect(
      await getLockedDocumentIds({
        collectionSlug: 'posts',
        ids: ['mine'],
        overrideLock: false,
        req,
      }),
    ).toEqual(new Set())
    expect(find).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
  })
})
