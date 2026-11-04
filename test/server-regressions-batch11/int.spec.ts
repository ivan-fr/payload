import { expect, vi } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { indexedSlug, postsSlug } from './slugs.js'

test.suite('Server regressions batch 11', { config: './config.ts' }, () => {
  test.afterEach(() => vi.restoreAllMocks())
  test('should store an empty optional timezone as null and retain valid values (#16283)', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: postsSlug,
      data: { date: '2026-01-01T12:00:00.000Z', date_tz: '' as never },
    })
    expect(doc.date_tz).toBeNull()
    const updated = await payload.update({
      collection: postsSlug,
      id: doc.id,
      data: { date_tz: 'Europe/Berlin' },
    })
    expect(updated.date_tz).toBe('Europe/Berlin')
    await payload.update({ collection: postsSlug, id: doc.id, data: { date_tz: '' as never } })
    expect((await payload.findByID({ collection: postsSlug, id: doc.id })).date_tz).toBeNull()
  })

  test('should reject missing and unknown block discriminators over REST without persisting a row (#16980)', async ({
    payload,
    restClient,
  }) => {
    for (const row of [
      { heading: 'Keep me' },
      { blockType: 'unknown', heading: 'Keep me' },
      { blockType: 'shared', heading: 'Not allowed here' },
    ]) {
      const response = await restClient.POST(`/${postsSlug}`, {
        body: JSON.stringify({ layout: [row] }),
      })
      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.errors[0].data.errors[0].path).toBe('layout.0.blockType')
    }
    expect((await payload.find({ collection: postsSlug })).totalDocs).toBe(0)
  })

  test('should preserve valid block creation and partial updates by row ID (#16980)', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: postsSlug,
      data: { layout: [{ blockType: 'hero', heading: 'Original' }] },
    })
    const updated = await payload.update({
      collection: postsSlug,
      id: doc.id,
      data: { layout: [{ id: doc.layout![0]!.id, heading: 'Updated' }] as never },
    })
    expect(updated.layout![0]).toMatchObject({ blockType: 'hero', heading: 'Updated' })
    const referenced = await payload.create({
      collection: postsSlug,
      data: { referenceLayout: [{ blockType: 'shared', heading: 'Allowed reference' }] },
    })
    expect(referenced.referenceLayout![0]).toMatchObject({
      blockType: 'shared',
      heading: 'Allowed reference',
    })
  })

  test('should return 400 for unknown select query options and keep valid/null queries (#19231)', async ({
    restClient,
    payload,
  }) => {
    for (const operator of ['equals', 'not_equals', 'in', 'not_in']) {
      const response = await restClient.GET(`/${postsSlug}`, {
        query: {
          where: {
            mode: { [operator]: operator.includes('in') ? ['online', 'badOption'] : 'badOption' },
          },
        },
      })
      expect(response.status).toBe(400)
    }
    for (const value of ['online', 'inPerson']) {
      expect(
        (await restClient.GET(`/${postsSlug}`, { query: { where: { mode: { equals: value } } } }))
          .status,
      ).toBe(200)
    }
    const empty = await payload.create({ collection: postsSlug, data: { title: 'No option' } })
    expect(
      (await payload.find({ collection: postsSlug, where: { mode: { equals: null } } })).docs.map(
        (doc) => doc.id,
      ),
    ).toEqual([empty.id])
    const missing = await restClient.GET(`/${postsSlug}`, {
      query: { where: { mode: { exists: false } } },
    })
    expect(missing.status).toBe(200)
    expect((await missing.json()).docs.map((doc: { id: number | string }) => doc.id)).toEqual([
      empty.id,
    ])
  })

  test.options(
    'should reject an index conflict and leave the parent unpublished (#17699)',
    { db: (db) => db !== 'firestore' && db !== 'cosmosdb' },
    async ({ payload }) => {
      await payload.create({
        overrideAccess: true,
        collection: indexedSlug,
        data: { title: 'First', _status: 'published' },
      })
      await expect(
        payload.create({
          overrideAccess: true,
          collection: indexedSlug,
          data: { title: 'Second', _status: 'published' },
        }),
      ).rejects.toThrow()
      expect(
        (await payload.find({ overrideAccess: true, collection: indexedSlug })).docs.map(
          (doc) => doc.title,
        ),
      ).toEqual(['First'])
    },
  )
  test.options(
    'should fail transactional reindexing instead of reporting a rolled-back index as success (#17699)',
    { db: (db) => db !== 'firestore' && db !== 'cosmosdb' },
    async ({ payload, restClient }) => {
      await payload.create({
        overrideAccess: true,
        collection: indexedSlug,
        data: { title: 'First', _status: 'published' },
      })
      await payload.create({
        overrideAccess: true,
        collection: indexedSlug,
        context: { skipSearch: true },
        data: { title: 'Second', _status: 'published' },
      })
      const before = await payload.find({ overrideAccess: true, collection: 'search', depth: 0 })
      await payload.create({
        overrideAccess: true,
        collection: 'users',
        data: { email: 'admin@example.com', password: 'test' },
      })
      await restClient.login({
        slug: 'users',
        credentials: { email: 'admin@example.com', password: 'test' },
      })
      const response = await restClient.POST('/search/reindex', {
        body: JSON.stringify({ collections: [indexedSlug] }),
      })
      expect(response.status).toBe(500)
      const after = await payload.find({ overrideAccess: true, collection: 'search', depth: 0 })
      expect(after.docs).toEqual(before.docs)
    },
  )
  test('should report a failed standalone reindex without promising a rollback', async ({
    payload,
    restClient,
  }) => {
    vi.spyOn(payload.db, 'beginTransaction').mockResolvedValue(null)
    await payload.create({
      overrideAccess: true,
      collection: indexedSlug,
      data: { title: 'First', _status: 'published' },
    })
    await expect(
      payload.create({
        overrideAccess: true,
        collection: indexedSlug,
        data: { title: 'Second', _status: 'published' },
      }),
    ).rejects.toThrow()
    // Without transactions the source write has already completed before its hook fails.
    expect((await payload.find({ overrideAccess: true, collection: indexedSlug })).totalDocs).toBe(
      2,
    )
    await payload.create({
      overrideAccess: true,
      collection: 'users',
      data: { email: 'admin@example.com', password: 'test' },
    })
    await restClient.login({
      slug: 'users',
      credentials: { email: 'admin@example.com', password: 'test' },
    })
    const response = await restClient.POST('/search/reindex', {
      body: JSON.stringify({ collections: [indexedSlug] }),
    })
    expect(response.status).toBe(200)
    expect((await response.json()).message).toContain('1 of 2')
    expect((await payload.find({ overrideAccess: true, collection: 'search' })).totalDocs).toBe(1)
  })
})
