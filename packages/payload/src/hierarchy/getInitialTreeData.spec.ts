import type { Payload } from '../index.js'

import { describe, expect, it, vi } from 'vitest'

import { getInitialTreeData } from './getInitialTreeData.js'

const fixture = () => {
  const find = vi.fn(async ({ where }) => ({
    docs: 'equals' in where.parent ? [{ id: 17, parent: 16 }] : [{ id: 16 }],
    totalDocs: 1,
    hasNextPage: false,
  }))
  const payload = {
    collections: {
      folders: {
        config: {
          hierarchy: { parentFieldName: 'parent', admin: { treeLimit: 10 } },
          admin: { useAsTitle: 'id' },
        },
      },
    },
    find,
  } as unknown as Payload
  return { find, payload }
}

describe('hierarchy expanded IDs (#18380)', () => {
  it('should load one parent once when preferences and URL use numeric and string IDs', async () => {
    const { payload, find } = fixture()
    const result = await getInitialTreeData({
      collectionSlug: 'folders',
      expandedNodeIds: [16, '16', 16],
      payload,
      selectedNodeId: '16',
      user: null,
    })
    expect(result.docs.map(({ id }) => id)).toEqual([16, 17])
    expect(find).toHaveBeenCalledTimes(2)
    expect(result.loadedParents['16']).toEqual({ hasMore: false, loadedCount: 1, totalDocs: 1 })
  })
  it('should preserve distinct parent IDs and the caller array', async () => {
    const { payload, find } = fixture()
    const ids = ['one', 'two', 'one']
    await getInitialTreeData({
      collectionSlug: 'folders',
      expandedNodeIds: ids,
      payload,
      user: null,
    })
    expect(find).toHaveBeenCalledTimes(3)
    expect(ids).toEqual(['one', 'two', 'one'])
    for (const [args] of find.mock.calls)
      expect(args).toMatchObject({ overrideAccess: false, user: null })
  })
})
