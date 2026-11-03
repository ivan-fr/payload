import type { CollectionConfig, PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { getParents } from './getParents.js'

const collection = { slug: 'pages' } as CollectionConfig
const request = (docs: Record<string, Record<string, unknown>>) => {
  const findByID = vi.fn(async ({ id }) => {
    if (findByID.mock.calls.length > 12) throw new Error('Unbounded traversal')
    return docs[String(id)] ?? null
  })
  return { payload: { findByID } } as unknown as PayloadRequest
}

describe('nested parent traversal (#16517)', () => {
  it.each([
    [{ id: 1, parent: 1 }, { '1': { id: 1, parent: 1 } }],
    [
      { id: 1, parent: 2 },
      { '2': { id: 2, parent: '1' }, '1': { id: 1, parent: 2 } },
    ],
  ])('should reject a cyclic ID chain with a client error', async (doc, docs) => {
    await expect(getParents(request(docs), {}, collection, doc)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('cycle'),
    })
  })

  it('should reject cycles between populated objects without IDs', async () => {
    const doc: Record<string, unknown> = {}
    doc.parent = { parent: doc }
    await expect(getParents(request({}), {}, collection, doc)).rejects.toThrow('cycle')
  })

  it('should retain root-first order, custom fields, numeric zero and supplied ancestors', async () => {
    const root = { id: 0 }
    const middle = { id: 2, ancestor: 0 }
    const req = request({ '0': root, '2': middle })
    const supplied = [{ id: 4 }]
    expect(
      await getParents(
        req,
        { parentFieldSlug: 'ancestor' },
        collection,
        { id: 3, ancestor: 2 },
        supplied,
      ),
    ).toEqual([root, middle, ...supplied])
    expect(req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ req, overrideAccess: true, depth: 0 }),
    )
    expect(supplied).toEqual([{ id: 4 }])
  })

  it('should stop at a missing ancestor', async () => {
    expect(await getParents(request({}), {}, collection, { id: 1, parent: 9 })).toEqual([])
  })
})
