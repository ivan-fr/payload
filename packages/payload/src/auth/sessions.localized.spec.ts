import type { Payload, PayloadRequest } from '../types/index.js'

import mongoose from 'mongoose'
import { describe, expect, it, vi } from 'vitest'

import { addSessionToUser, extendSession, revokeSession } from './sessions.js'

describe('session-only persistence with localized user fields (#17295)', () => {
  it.each(['add', 'extend', 'revoke'] as const)(
    'should not write flattened profile fields when sessions %s',
    async (action) => {
      const model = new mongoose.Mongoose().model(
        'LocalizedSessionUser',
        new mongoose.Schema({
          displayName: new mongoose.Schema({ en: String, es: String }, { _id: false }),
          sessions: [{ id: String, createdAt: Date, expiresAt: Date }],
          updatedAt: Date,
        }),
      )
      const updateOne = vi.fn(async ({ data }) => model.castObject(data))
      const payload = { db: { updateOne } } as unknown as Payload
      const req = { payload, context: {} } as PayloadRequest
      const user = {
        id: 'user-1',
        collection: 'users',
        displayName: 'Flattened name',
        sessions: [
          { id: 'session-1', createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
        ],
      }
      const collectionConfig = {
        slug: 'users',
        auth: { useSessions: true, tokenExpiration: 3600 },
      } as never

      if (action === 'add') await addSessionToUser({ collectionConfig, payload, req, user })
      else if (action === 'extend')
        await extendSession({ collectionConfig, req, user, sid: 'session-1' })
      else await revokeSession({ collectionConfig, payload, req, user, sid: 'session-1' })

      expect(updateOne).toHaveBeenCalledOnce()
      expect(Object.keys(updateOne.mock.calls[0]![0].data).sort()).toEqual([
        'sessions',
        'updatedAt',
      ])
      expect(user.displayName).toBe('Flattened name')
    },
  )
})
