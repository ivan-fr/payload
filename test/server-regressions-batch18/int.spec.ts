import type { Payload } from 'payload'
import type { Config } from './payload-types.js'

import { expect, vi } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { otherUsersSlug, usersSlug } from './slugs.js'

const createUser = async ({
  payload,
  email,
  blockDelete = false,
  collection = usersSlug,
}: {
  payload: Payload
  email: string
  blockDelete?: boolean
  collection?: typeof usersSlug | typeof otherUsersSlug
}) =>
  payload.create({
    overrideAccess: true,
    collection,
    data: { email, password: 'password', blockDelete },
  })
const preference = async ({
  payload,
  user,
  key,
}: {
  payload: Payload
  user: Config['user']
  key: string
}) =>
  payload.create({
    collection: 'payload-preferences',
    overrideAccess: true,
    user,
    data: { key, value: { setting: true }, user: { relationTo: user.collection, value: user.id } },
  })
const allPreferences = async ({ payload }: { payload: Payload }) =>
  (
    await payload.find({
      collection: 'payload-preferences',
      overrideAccess: true,
      pagination: false,
      depth: 0,
    })
  ).docs

test.suite('user preference cleanup (#19242)', { config: './config.ts' }, () => {
  test('should delete owned preferences and preserve another auth collection', async ({
    payload,
  }) => {
    const user = await createUser({ payload, email: 'first@example.com' })
    const other = await createUser({
      payload,
      email: 'other@example.com',
      collection: otherUsersSlug,
    })
    await preference({
      payload,
      user: { ...user, collection: usersSlug } as Config['user'],
      key: 'theme',
    })
    await preference({
      payload,
      user: { ...user, collection: usersSlug } as Config['user'],
      key: 'locale',
    })
    const keep = await preference({
      payload,
      user: { ...other, collection: otherUsersSlug } as Config['user'],
      key: 'theme',
    })
    await payload.delete({ collection: usersSlug, id: user.id, overrideAccess: true })
    expect((await allPreferences({ payload })).map(({ id }) => id)).toEqual([keep.id])
  })
  for (const individual of [false, true])
    test(`should clean successful bulk deletes and preserve refused users (individual: ${individual})`, async ({
      payload,
    }) => {
      const previous = payload.db.bulkOperationsSingleTransaction
      payload.db.bulkOperationsSingleTransaction = individual
      try {
        const allowed = await createUser({ payload, email: 'allowed@example.com' })
        const blocked = await createUser({
          payload,
          email: 'blocked@example.com',
          blockDelete: true,
        })
        await preference({
          payload,
          user: { ...allowed, collection: usersSlug } as Config['user'],
          key: 'theme',
        })
        const keep = await preference({
          payload,
          user: { ...blocked, collection: usersSlug } as Config['user'],
          key: 'theme',
        })
        const result = await payload.delete({
          collection: usersSlug,
          where: { id: { in: [allowed.id, blocked.id] } },
          overrideAccess: true,
        })
        expect(result.docs.map(({ id }) => id)).toEqual([allowed.id])
        expect(result.errors).toHaveLength(1)
        expect((await allPreferences({ payload })).map(({ id }) => id)).toEqual([keep.id])
      } finally {
        payload.db.bulkOperationsSingleTransaction = previous
      }
    })
  test('should retain preferences if the database delete fails without a transaction', async ({
    payload,
  }) => {
    const user = await createUser({ payload, email: 'failed@example.com' })
    const keep = await preference({
      payload,
      user: { ...user, collection: usersSlug } as Config['user'],
      key: 'theme',
    })
    const original = payload.db.deleteOne.bind(payload.db)
    const failure = new Error('Database refused delete')
    const spy = vi.spyOn(payload.db, 'deleteOne').mockImplementation((args) => {
      if (args.collection === usersSlug) throw failure
      return original(args)
    })
    try {
      await expect(
        payload.delete({
          collection: usersSlug,
          id: user.id,
          overrideAccess: true,
          disableTransaction: true,
        }),
      ).rejects.toBe(failure)
      expect((await allPreferences({ payload })).map(({ id }) => id)).toEqual([keep.id])
      expect(
        await payload.findByID({ collection: usersSlug, id: user.id, overrideAccess: true }),
      ).toBeTruthy()
    } finally {
      spy.mockRestore()
    }
  })
})
