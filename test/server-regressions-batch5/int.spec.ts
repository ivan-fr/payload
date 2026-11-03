import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { postsSlug, placesSlug, eventsSlug, mediaSlug } from './slugs.js'

test.suite('Server regressions batch 5', { config: './config.ts' }, () => {
  for (const depth of [0, 1, 2, 3]) {
    test(`should populate virtual relationships at depth ${depth} (#19251)`, async ({
      payload,
    }) => {
      const post = await payload.create({ collection: postsSlug, data: { title: 'Target' } })
      const media = await payload.create({ collection: mediaSlug, data: { alt: 'Image' } })
      const place = await payload.create({
        collection: placesSlug,
        data: { title: 'Place', image: media.id, related: post.id, many: [post.id] },
      })
      const event = await payload.create({ collection: eventsSlug, data: { place: place.id } })
      const doc = await payload.findByID({
        collection: eventsSlug,
        id: event.id,
        depth,
        overrideAccess: false,
      })

      expect(doc.imageAlias).toEqual(
        depth ? expect.objectContaining({ id: media.id, alt: 'Image' }) : media.id,
      )
      expect(doc.alias).toEqual(
        depth ? expect.objectContaining({ id: post.id, title: 'Target' }) : post.id,
      )
      expect(doc.manyAlias).toEqual([depth ? expect.objectContaining({ id: post.id }) : post.id])
      expect(doc.limitedAlias).toBe(post.id)
      expect(doc.deniedAlias).toBeUndefined()
      expect(doc.titleAlias).toBe('Place')
      const selected = await payload.findByID({
        collection: eventsSlug,
        id: event.id,
        select: { place: true },
        depth,
      })

      expect(selected).not.toHaveProperty('alias')
    })
  }
  for (const operation of ['update', 'delete'] as const) {
    test(`should persist every reported bulk ${operation} success (#18494)`, async ({
      payload,
    }) => {
      const wasSingleTransaction = payload.db.bulkOperationsSingleTransaction
      payload.db.bulkOperationsSingleTransaction = true

      try {
        for (const title of ['a', 'b', 'fail', 'c', 'd']) {
          await payload.create({ collection: postsSlug, data: { title } })
        }
        const args = { collection: postsSlug, where: {}, sort: 'createdAt', depth: 0 } as const
        const result =
          operation === 'update'
            ? await payload.update({ ...args, data: { archived: true } })
            : await payload.delete(args)
        const persisted = await payload.find({ collection: postsSlug, pagination: false, depth: 0 })

        expect(result.errors).toHaveLength(1)
        expect(result.docs.map((doc) => doc.title).sort()).toEqual(['a', 'b', 'c', 'd'])
        expect(
          persisted.docs
            .filter((doc) => operation === 'delete' || !doc.archived)
            .map((doc) => doc.title),
        ).toEqual(['fail'])
        expect(Object.keys(payload.db.sessions)).toHaveLength(0)
      } finally {
        payload.db.bulkOperationsSingleTransaction = wasSingleTransaction
      }
    })
  }
  test.options(
    'should read draft documents using the version default sort (#19184)',
    { db: 'mongo' },
    async ({ payload }) => {
      const post = await payload.create({
        collection: postsSlug,
        draft: true,
        data: { title: 'Draft' },
      })
      const doc = await payload.findByID({ collection: postsSlug, id: post.id, draft: true })

      expect(doc.title).toBe('Draft')
    },
  )

  for (const operator of ['like', 'not_like', 'contains'] as const) {
    test(`should match literal wildcard characters with ${operator} (#18325)`, async ({
      payload,
    }) => {
      const titles = ['50% off', '500 off', 'a_b', 'axb', 'a\\b', 'ab']

      for (const title of titles) {
        await payload.create({ collection: postsSlug, data: { title } })
      }
      for (const [value, expected] of [
        ['50%', '50% off'],
        ['a_b', 'a_b'],
        ['a\\b', 'a\\b'],
      ]) {
        const result = await payload.find({
          collection: postsSlug,
          where: { title: { [operator]: value } },
          pagination: false,
        })

        expect(result.docs.map((doc) => doc.title).sort()).toEqual(
          (operator === 'not_like'
            ? titles.filter((title) => title !== expected)
            : [expected]
          ).sort(),
        )
      }
    })
  }
})
