import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { pagesSlug, postsSlug, tagsSlug } from './slugs.js'

const fieldName = 'parent'

test.suite('hierarchy regressions batch 17', { config: './config.ts' }, () => {
  test('should retain other tags and clear only the last deleted tag (#18815)', async ({
    payload,
  }) => {
    const news = await payload.create({
      overrideAccess: true,
      collection: tagsSlug,
      data: { name: 'News' },
    })
    const sport = await payload.create({
      overrideAccess: true,
      collection: tagsSlug,
      data: { name: 'Sport' },
    })
    const post = await payload.create({
      overrideAccess: true,
      collection: postsSlug,
      data: { title: 'Hello', [fieldName]: [news.id, sport.id] },
    })
    await payload.delete({ overrideAccess: true, collection: tagsSlug, id: sport.id })
    expect(
      (
        await payload.findByID({
          overrideAccess: true,
          collection: postsSlug,
          id: post.id,
          depth: 0,
        })
      )[fieldName],
    ).toEqual([news.id])
    await payload.delete({ overrideAccess: true, collection: tagsSlug, id: news.id })
    expect(
      (
        await payload.findByID({
          overrideAccess: true,
          collection: postsSlug,
          id: post.id,
          depth: 0,
        })
      )[fieldName],
    ).toEqual([])
  })
  test('should clear a single-value tag without touching other documents (#18815)', async ({
    payload,
  }) => {
    const news = await payload.create({
      overrideAccess: true,
      collection: tagsSlug,
      data: { name: 'News' },
    })
    const sport = await payload.create({
      overrideAccess: true,
      collection: tagsSlug,
      data: { name: 'Sport' },
    })
    const page = await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { [fieldName]: sport.id },
    })
    const other = await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { [fieldName]: news.id },
    })
    await payload.delete({ overrideAccess: true, collection: tagsSlug, id: sport.id })
    expect(
      (
        await payload.findByID({
          overrideAccess: true,
          collection: pagesSlug,
          id: page.id,
          depth: 0,
        })
      )[fieldName],
    ).toBeNull()
    expect(
      (
        await payload.findByID({
          overrideAccess: true,
          collection: pagesSlug,
          id: other.id,
          depth: 0,
        })
      )[fieldName],
    ).toBe(news.id)
  })
  test('should create a hierarchy document with its title in an unnamed tab (#18816)', async ({
    payload,
  }) => {
    const tag = await payload.create({
      overrideAccess: true,
      collection: tagsSlug,
      data: { name: 'News' },
    })
    expect(tag.name).toBe('News')
    expect(
      (await payload.findByID({ overrideAccess: true, collection: tagsSlug, id: tag.id })).name,
    ).toBe('News')
  })
  test.options(
    'should find tagged children across collections (#18814)',
    { db: 'mongo' },
    async ({ payload }) => {
      const news = await payload.create({
        overrideAccess: true,
        collection: tagsSlug,
        data: { name: 'News' },
      })
      const sport = await payload.create({
        overrideAccess: true,
        collection: tagsSlug,
        data: { name: 'Sport' },
      })
      const post = await payload.create({
        overrideAccess: true,
        collection: postsSlug,
        data: { title: 'Hello', [fieldName]: [news.id, sport.id] },
      })
      const page = await payload.create({
        overrideAccess: true,
        collection: pagesSlug,
        data: { [fieldName]: news.id },
      })
      const tag = await payload.findByID({
        overrideAccess: true,
        collection: tagsSlug,
        id: news.id,
        depth: 0,
        joins: { children: { count: true, limit: 10 } },
      })
      expect(tag.name).toBe('News')
      expect(tag.children!.docs).toHaveLength(2)
      expect(tag.children!.docs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ relationTo: postsSlug, value: post.id }),
          expect.objectContaining({ relationTo: pagesSlug, value: page.id }),
        ]),
      )
      expect(tag.children!.totalDocs).toBe(2)
    },
  )
})
