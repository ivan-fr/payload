import { createPayloadRequest, getAccessResults } from 'payload'
import { expect, vi } from 'vitest'

import { test } from '../__helpers/int/vitest.js'

test.suite('Migration collection access (#19204)', { config: './config.ts' }, () => {
  test('should deny enforced migration access while trusted migration writes still work', async ({
    payload,
  }) => {
    const users = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
    const req = await createPayloadRequest({
      payload,
      user: { ...users.docs[0]!, collection: 'users' },
    })
    const entry = await payload.create({
      collection: 'payload-migrations',
      data: { name: 'access-regression', batch: 1 },
      overrideAccess: true,
    })
    const permissions = await getAccessResults({ req })

    expect(permissions.collections?.['payload-migrations']?.read).not.toBe(true)
    await expect(
      payload.find({ collection: 'payload-migrations', req, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.create({
        collection: 'payload-migrations',
        data: { name: 'forbidden', batch: 2 },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'payload-migrations',
        id: entry.id,
        data: { batch: 2 },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.delete({
        collection: 'payload-migrations',
        id: entry.id,
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })

    const updated = await payload.update({
      collection: 'payload-migrations',
      id: entry.id,
      data: { batch: 2 },
      overrideAccess: true,
    })
    expect(updated.batch).toBe(2)
    expect(
      (
        await payload.findByID({
          collection: 'payload-migrations',
          id: entry.id,
          overrideAccess: true,
        })
      ).name,
    ).toBe('access-regression')
    await payload.delete({ collection: 'payload-migrations', id: entry.id, overrideAccess: true })
  })

  test('should run and record trusted migrations exactly once with access denied by default', async ({
    payload,
  }) => {
    const up = vi.fn().mockResolvedValue(undefined)
    const migrations = [
      { name: 'migration-access-trusted-control', up, down: async () => undefined },
    ]
    await payload.db.migrate({ migrations, forceAcceptWarning: true, shouldPrompt: false })
    await payload.db.migrate({ migrations, forceAcceptWarning: true, shouldPrompt: false })
    const records = await payload.find({
      collection: 'payload-migrations',
      where: { name: { equals: 'migration-access-trusted-control' } },
      overrideAccess: true,
    })

    expect(up).toHaveBeenCalledTimes(1)
    expect(records.docs).toHaveLength(1)
    expect(records.docs[0]?.batch).toBe(1)
  })
})
