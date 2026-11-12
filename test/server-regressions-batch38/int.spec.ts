import type { Where } from 'payload'

import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import {
  articlesSlug,
  categoriesSlug,
  documentsSlug,
  holdersSlug,
  notesSlug,
  pagesSlug,
  postsSlug,
} from './slugs.js'

test.suite('batch 38 query regressions', { config: './config.ts' }, () => {
  test('should skip hidden and denied field hooks on a public read (#18331)', async ({
    payload,
    restClient,
  }) => {
    const doc = await payload.create({
      collection: postsSlug,
      data: { title: 'Public', secret: 'Private' },
      overrideAccess: true,
    })
    const fieldReadCalls: string[] = []
    const result = await payload.findByID({
      collection: postsSlug,
      id: doc.id,
      context: { fieldReadCalls },
      overrideAccess: false,
    })
    const response = await restClient.GET(`/${postsSlug}/${doc.id}`)
    const publicDoc = await response.json()

    expect(fieldReadCalls).toEqual([])
    expect(result).not.toHaveProperty('secret')
    expect(result).not.toHaveProperty('internal')
    expect(response.status).toBe(200)
    expect(publicDoc).not.toHaveProperty('secret')
    expect(publicDoc).not.toHaveProperty('internal')
  })
  for (const notesAccess of ['deny', 'where'] as const) {
    test(`should scope ${notesAccess} access to its polymorphic branch (#18332)`, async ({
      payload,
    }) => {
      const holder = await payload.create({
        collection: holdersSlug,
        data: {},
        overrideAccess: true,
        depth: 0,
      })
      const article = await payload.create({
        collection: articlesSlug,
        data: { title: 'Article', owner: holder.id },
        overrideAccess: true,
        depth: 0,
      })
      const visible = await payload.create({
        collection: notesSlug,
        data: { title: 'Public note', visibility: 'public', owner: holder.id },
        overrideAccess: true,
        depth: 0,
      })

      await payload.create({
        collection: notesSlug,
        data: { title: 'Private note', visibility: 'private', owner: holder.id },
        overrideAccess: true,
        depth: 0,
      })
      const result = await payload.findByID({
        collection: holdersSlug,
        id: holder.id,
        context: { notesAccess },
        overrideAccess: false,
        depth: 0,
        joins: { entries: { count: true, limit: 10 } },
      })
      const entries = result.entries!.docs!

      const expectedEntries = [
        { relationTo: articlesSlug, value: article.id },
        ...(notesAccess === 'where' ? [{ relationTo: notesSlug, value: visible.id }] : []),
      ]

      expect(entries.map(({ relationTo, value }) => ({ relationTo, value }))).toEqual(
        expect.arrayContaining(expectedEntries),
      )
      expect(entries).toHaveLength(expectedEntries.length)
      expect(result.entries!.totalDocs).toBe(entries.length)
    })
  }

  test('should query scalar and relationship fields in an array block (#18312)', async ({
    payload,
  }) => {
    const target = await payload.create({
      collection: documentsSlug,
      data: { title: 'Artist' },
      select: { title: true },
      overrideAccess: true,
      depth: 0,
    })
    const page = await payload.create({
      collection: pagesSlug,
      data: {
        title: 'Match',
        lineup: [
          {
            performers: [
              { blockType: 'guest', name: 'Guest' },
              { blockType: 'artist', artist: target.id },
            ],
          },
        ],
      },
      overrideAccess: true,
      depth: 0,
    })

    await payload.create({
      collection: pagesSlug,
      data: { title: 'Other placement', otherPerformers: [{ blockType: 'guest', name: 'Guest' }] },
      overrideAccess: true,
      depth: 0,
    })
    const predicates: Where[] = [
      { 'lineup.performers.name': { equals: 'Guest' } },
      { 'lineup.performers.blockType': { equals: 'guest' } },
      { 'lineup.performers.artist': { in: [target.id] } },
    ]

    for (const where of predicates) {
      const result = await payload.find({
        collection: pagesSlug,
        where,
        depth: 0,
        overrideAccess: true,
      })

      expect(result.docs.map(({ id }) => id)).toEqual([page.id])
    }
  })

  test.options(
    'should read inverse joins through explicit block slugs and arrays (#18273)',
    { db: 'drizzle' },
    async ({ payload }) => {
      const target = await payload.create({
        collection: documentsSlug,
        data: { title: 'Target' },
        select: { title: true },
        overrideAccess: true,
        depth: 0,
      })
      const page = await payload.create({
        collection: pagesSlug,
        data: {
          layout: [{ blockType: 'list', targets: [target.id], groups: [{ targets: [target.id] }] }],
        },
        overrideAccess: true,
        depth: 0,
      })
      const result = await payload.findByID({
        collection: documentsSlug,
        id: target.id,
        overrideAccess: true,
        depth: 0,
        joins: { listedOn: { count: true }, listedInGroups: { count: true } },
      })

      expect(result.listedOn!.docs).toEqual([page.id])
      expect(result.listedInGroups!.docs).toEqual([page.id])
      expect(result.listedOn!.totalDocs).toBe(1)
      expect(result.listedInGroups!.totalDocs).toBe(1)
    },
  )

  test('should keep repeated block placements separate in the same query (#18312)', async ({
    payload,
  }) => {
    const page = await payload.create({
      collection: pagesSlug,
      data: {
        lineup: [{ performers: [{ blockType: 'guest', name: 'First' }] }],
        otherPerformers: [{ blockType: 'guest', name: 'Second' }],
      },
      overrideAccess: true,
      depth: 0,
    })
    const result = await payload.find({
      collection: pagesSlug,
      where: {
        and: [
          { 'lineup.performers.name': { equals: 'First' } },
          { 'otherPerformers.name': { equals: 'Second' } },
        ],
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(result.docs.map(({ id }) => id)).toEqual([page.id])
  })

  test('should retain range predicates beside explicit and conditions (#18355)', async ({
    payload,
  }) => {
    await payload.create({
      collection: postsSlug,
      data: { title: 'needle', score: 9 },
      overrideAccess: true,
    })
    const expected = await payload.create({
      collection: postsSlug,
      data: { title: 'needle', score: 3 },
      overrideAccess: true,
    })
    const result = await payload.find({
      collection: postsSlug,
      overrideAccess: false,
      depth: 0,
      where: {
        score: { greater_than_equal: 2, less_than_equal: 4 },
        and: [{ title: { equals: 'needle' } }],
      },
    })

    expect(result.docs.map(({ id }) => id)).toEqual([expected.id])
  })

  test('should combine relationship conditions with target access constraints (#18355)', async ({
    payload,
  }) => {
    const a = await payload.create({
      collection: categoriesSlug,
      data: { slug: 'a', state: 'active' },
      overrideAccess: true,
    })
    const b = await payload.create({
      collection: categoriesSlug,
      data: { slug: 'b', state: 'active' },
      overrideAccess: true,
    })
    const expected = await payload.create({
      collection: postsSlug,
      data: { category: a.id, title: 'Visible' },
      overrideAccess: true,
    })

    await payload.create({
      collection: postsSlug,
      data: { category: b.id, title: 'Other category' },
      overrideAccess: true,
    })
    const result = await payload.find({
      collection: postsSlug,
      overrideAccess: false,
      depth: 0,
      where: {
        'category.slug': { equals: 'a' },
        'category.state': { equals: 'active' },
        title: { exists: true },
        and: [{ score: { exists: false } }],
      },
    })

    expect(result.docs.map(({ id }) => id)).toEqual([expected.id])
  })
})
