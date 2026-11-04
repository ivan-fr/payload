import type { PayloadRequest } from '../../index.js'

import { describe, expect, it, vi } from 'vitest'

import { hierarchyCollectionAfterDelete } from './collectionAfterDelete.js'

describe('hierarchy deletion (#18815)', () => {
  it('should remove only the deleted tag, including the last tag, and reuse the request', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [
        { id: 'one', tags: [1, 2, 3] },
        { id: 'two', tags: [2] },
      ],
    })
    const update = vi.fn()
    const req = {
      transactionID: 'transaction',
      payload: { find, update },
    } as unknown as PayloadRequest
    await hierarchyCollectionAfterDelete({
      hasManyCollections: ['posts'],
      relatedCollections: { posts: 'tags' },
    })({ id: 2, req } as never)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 0, pagination: false, req, where: { tags: { equals: 2 } } }),
    )
    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'one', data: { tags: [1, 3] }, req }),
    )
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'two', data: { tags: [] }, req }),
    )
  })
  it('should keep bulk clearing for single-value relationships', async () => {
    const update = vi.fn()
    const req = { payload: { update } } as unknown as PayloadRequest
    await hierarchyCollectionAfterDelete({
      relatedCollections: { pages: 'folder' },
    })({ id: 'folder', req } as never)
    expect(update).toHaveBeenCalledExactlyOnceWith({
      collection: 'pages',
      data: { folder: null },
      overrideAccess: true,
      req,
      where: { folder: { equals: 'folder' } },
    })
  })
  it('should propagate cleanup errors to the enclosing delete transaction', async () => {
    const failure = new Error('write failed')
    const req = {
      payload: {
        find: vi.fn().mockResolvedValue({ docs: [{ id: 'post', tags: ['tag'] }] }),
        update: vi.fn().mockRejectedValue(failure),
      },
    } as unknown as PayloadRequest
    await expect(
      hierarchyCollectionAfterDelete({
        hasManyCollections: ['posts'],
        relatedCollections: { posts: 'tags' },
      })({ id: 'tag', req } as never),
    ).rejects.toBe(failure)
  })
})
