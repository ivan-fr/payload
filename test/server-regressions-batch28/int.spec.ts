import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { collisionsSlug, valuesSlug } from './slugs.js'

const data = { numbers: [{ value: 12 }], texts: [{ value: 'Text array' }] }

test.suite('reserved array names (#16181)', { config: './config.ts', db: 'drizzle' }, () => {
  test('should create and read arrays without requesting nonexistent internal relations', async ({
    payload,
  }) => {
    const doc = await payload.create({ collection: collisionsSlug, overrideAccess: true, data })
    const found = await payload.findByID({
      collection: collisionsSlug,
      id: doc.id,
      overrideAccess: true,
    })
    expect(found).toMatchObject(data)
    const selected = await payload.findByID({
      collection: collisionsSlug,
      id: doc.id,
      overrideAccess: true,
      select: { numbers: true },
    })
    expect(selected.numbers).toEqual([expect.objectContaining({ value: 12 })])
  })
  test('should read versioned draft arrays with the same reserved names', async ({ payload }) => {
    const doc = await payload.create({
      collection: collisionsSlug,
      overrideAccess: true,
      data: { ...data, _status: 'published' },
    })
    await payload.update({
      collection: collisionsSlug,
      id: doc.id,
      overrideAccess: true,
      draft: true,
      data: { numbers: [{ value: 25 }] },
    })
    const draft = await payload.findByID({
      collection: collisionsSlug,
      id: doc.id,
      overrideAccess: true,
      draft: true,
    })
    const published = await payload.findByID({
      collection: collisionsSlug,
      id: doc.id,
      overrideAccess: true,
      draft: false,
    })
    expect(draft.numbers).toEqual([expect.objectContaining({ value: 25 })])
    expect(published.numbers).toEqual([expect.objectContaining({ value: 12 })])
  })
  test('should continue loading real text, number and relationship tables', async ({ payload }) => {
    const target = await payload.create({ collection: collisionsSlug, overrideAccess: true, data })
    const doc = await payload.create({
      collection: valuesSlug,
      overrideAccess: true,
      data: { labels: ['first', 'second'], scores: [0, 3], related: [target.id] },
    })
    const result = await payload.findByID({
      collection: valuesSlug,
      id: doc.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(result).toMatchObject({
      labels: ['first', 'second'],
      scores: [0, 3],
      related: [target.id],
    })
  })
})
