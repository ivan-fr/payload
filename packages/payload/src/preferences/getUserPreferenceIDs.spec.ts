import type { PayloadRequest, SanitizedCollectionConfig } from '../index.js'

import { describe, expect, it, vi } from 'vitest'

import { deleteUserPreferences } from './deleteUserPreferences.js'
import { getUserPreferenceIDs } from './getUserPreferenceIDs.js'

describe('preference ownership capture (#19242)', () => {
  it('should capture IDs with auth collection and transaction scoping, then delete by captured ID', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 'pref' }] })
    const deleteMany = vi.fn()
    const req = {
      transactionID: 'same-transaction',
      payload: { db: { find, deleteMany } },
    } as unknown as PayloadRequest
    const collectionConfig = { slug: 'users', auth: {} } as SanitizedCollectionConfig
    const preferenceIDs = await getUserPreferenceIDs({ collectionConfig, ids: [1], req })
    expect(preferenceIDs).toEqual(['pref'])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        limit: 0,
        pagination: false,
        select: { id: true },
        where: { and: [{ 'user.value': { in: [1] } }, { 'user.relationTo': { equals: 'users' } }] },
      }),
    )
    expect(deleteMany).not.toHaveBeenCalled()
    await deleteUserPreferences({
      collectionConfig,
      ids: [1],
      payload: req.payload,
      preferenceIDs,
      req,
    })
    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        where: {
          or: expect.arrayContaining([
            { id: { in: ['pref'] } },
            { key: { in: ['collection-users-1'] } },
          ]),
        },
      }),
    )
  })
  it('should skip ownership reads for ordinary collections or empty selections', async () => {
    const find = vi.fn()
    const req = { payload: { db: { find } } } as unknown as PayloadRequest
    expect(
      await getUserPreferenceIDs({
        collectionConfig: { auth: false } as SanitizedCollectionConfig,
        ids: [1],
        req,
      }),
    ).toEqual([])
    expect(
      await getUserPreferenceIDs({
        collectionConfig: { auth: {} } as SanitizedCollectionConfig,
        ids: [],
        req,
      }),
    ).toEqual([])
    expect(find).not.toHaveBeenCalled()
  })
})
