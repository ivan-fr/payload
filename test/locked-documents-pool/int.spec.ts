import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { createPayloadRequest, initTransaction, killTransaction } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { noFilesRequiredSlug } from '../uploads/shared.js'
import { simpleSlug, usersSlug } from '../locked-documents/slugs.js'

const locksSlug = 'payload-locked-documents'

function getUploadDirectory({ payload }: { payload: Payload }) {
  const upload = payload.collections[noFilesRequiredSlug].config.upload

  if (!upload || !upload.staticDir) {
    throw new Error('The pool regression fixture requires a local upload collection.')
  }
  return upload.staticDir
}

async function assertPoolReleased({ payload }: { payload: Payload }) {
  const db = payload.db as unknown as PostgresAdapter

  // A successful query also proves the pool remains usable after commit or rollback.
  await db.pool.query('SELECT 1')
  expect(db.pool.options.max).toBe(1)
  expect(db.pool.totalCount).toBe(1)
  expect(db.pool.waitingCount).toBe(0)
  expect(db.pool.idleCount).toBe(1)
  expect(Object.keys(db.sessions)).toEqual([])
}

async function createDocuments({ payload }: { payload: Payload }) {
  const docs = []

  // Seed serially: only the operations under test should contend for the pool.
  for (let index = 0; index < 3; index++) {
    docs.push(
      await payload.create({
        collection: simpleSlug,
        data: { fieldA: `original-${index}` },
        overrideAccess: true,
      }),
    )
  }

  return docs
}

test.suite(
  'Document locks on a single-connection PostgreSQL pool (#18406)',
  { config: './config.ts', cron: false, db: (adapter) => adapter === 'postgres' },
  () => {
    test.afterEach(async ({ payload }) => {
      const db = payload.db as unknown as PostgresAdapter

      for (const transactionID of Object.keys(db.sessions)) {
        await db.rollbackTransaction(transactionID)
      }
      await rm(getUploadDirectory({ payload }), {
        force: true,
        recursive: true,
      })
    })

    test.afterAll(async ({ payloadInstance }) => {
      await (payloadInstance.db as unknown as PostgresAdapter).pool.end()
    })

    test('should detect a lock read that tries to acquire a second connection', async ({
      payload,
    }) => {
      const req = await createPayloadRequest({ payload })
      await initTransaction(req)

      try {
        // Negative control: this is the original missing-req pattern, against a real pool.
        await expect(
          payload.db.find({
            collection: locksSlug,
            limit: 1,
            pagination: false,
            where: {},
          }),
        ).rejects.toMatchObject({
          cause: expect.objectContaining({ message: expect.stringMatching(/timeout|timed out/i) }),
        })
      } finally {
        await killTransaction(req)
      }

      await assertPoolReleased({ payload })
    }, 15000)

    test('should finish concurrent lock-checked updates without borrowing another connection', async ({
      payload,
    }) => {
      const docs = await createDocuments({ payload })
      const results = await Promise.allSettled(
        docs.map((doc) =>
          payload.update({
            collection: simpleSlug,
            id: doc.id,
            data: { fieldA: 'updated' },
            overrideAccess: true,
            overrideLock: false,
          }),
        ),
      )

      expect(results.filter(({ status }) => status === 'rejected')).toEqual([])
      const saved = await payload.find({
        collection: simpleSlug,
        where: { id: { in: docs.map(({ id }) => id) } },
        overrideAccess: true,
      })

      expect(saved.docs).toHaveLength(3)
      expect(saved.docs.every(({ fieldA }) => fieldA === 'updated')).toBe(true)
      await assertPoolReleased({ payload })
    }, 15000)

    test('should finish concurrent lock-checked deletes without borrowing another connection', async ({
      payload,
    }) => {
      const docs = await createDocuments({ payload })
      const results = await Promise.allSettled(
        docs.map((doc) =>
          payload.delete({
            collection: simpleSlug,
            id: doc.id,
            overrideAccess: true,
            overrideLock: false,
          }),
        ),
      )

      expect(results.filter(({ status }) => status === 'rejected')).toEqual([])
      const remaining = await payload.find({
        collection: simpleSlug,
        where: { id: { in: docs.map(({ id }) => id) } },
        overrideAccess: true,
      })

      expect(remaining.docs).toHaveLength(0)
      await assertPoolReleased({ payload })
    }, 15000)

    test('should preserve 423 locks and skip foreign-locked documents during bulk deletion', async ({
      payload,
    }) => {
      const [locked, ...unlocked] = await createDocuments({ payload })
      const owner = await payload.create({
        collection: usersSlug,
        data: { email: 'lock-pool-owner@example.com', password: 'test', roles: ['is_admin'] },
        overrideAccess: true,
      })
      await payload.create({
        collection: locksSlug,
        data: {
          document: { relationTo: simpleSlug, value: locked!.id },
          user: { relationTo: usersSlug, value: owner.id },
        },
        overrideAccess: true,
      })

      await expect(
        payload.update({
          collection: simpleSlug,
          id: locked!.id,
          data: { fieldA: 'forbidden' },
          overrideAccess: true,
          overrideLock: false,
        }),
      ).rejects.toMatchObject({ status: 423 })
      await expect(
        payload.delete({
          collection: simpleSlug,
          id: locked!.id,
          overrideAccess: true,
          overrideLock: false,
        }),
      ).rejects.toMatchObject({ status: 423 })

      const result = await payload.delete({
        collection: simpleSlug,
        where: { id: { in: [locked!.id, ...unlocked.map(({ id }) => id)] } },
        overrideAccess: true,
        overrideLock: false,
      })

      expect(result.docs.map(({ id }) => id).sort()).toEqual(unlocked.map(({ id }) => id).sort())
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.id).toBe(locked!.id)
      const saved = await payload.findByID({
        collection: simpleSlug,
        id: locked!.id,
        overrideAccess: true,
      })

      expect(saved.fieldA).toBe('original-0')
      await assertPoolReleased({ payload })
    }, 15000)

    test('should rename stored file bytes while checking locks inside its transaction', async ({
      payload,
    }) => {
      const bytes = Buffer.from('PostgreSQL single-connection rename regression')
      const created = await payload.create({
        collection: noFilesRequiredSlug,
        data: { title: 'pool rename' },
        file: { name: 'pool-before.txt', data: bytes, mimetype: 'text/plain', size: bytes.length },
        overrideAccess: true,
      })
      const renamed = await payload.renameFile({
        collection: noFilesRequiredSlug,
        id: created.id,
        filename: 'pool-after.txt',
        overrideAccess: true,
      })
      const saved = await payload.findByID({
        collection: noFilesRequiredSlug,
        id: created.id,
        overrideAccess: true,
      })

      expect(renamed.filename).toBe('pool-after-original.txt')
      expect(saved.filename).toBe(renamed.filename)
      expect(await readFile(path.join(getUploadDirectory({ payload }), saved.filename!))).toEqual(
        bytes,
      )
      await assertPoolReleased({ payload })
    }, 15000)
  },
)
