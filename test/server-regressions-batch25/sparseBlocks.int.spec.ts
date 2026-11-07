import { and, eq } from 'drizzle-orm'
import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { pagesSlug } from './slugs.js'

test.suite('sparse block storage (#17508)', { config: './config.ts', db: 'drizzle' }, () => {
  test('should preserve nested data while reading a legacy gap in stored block orders', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: pagesSlug,
      overrideAccess: true,
      data: {
        content: [
          { blockType: 'text', body: 'First' },
          { blockType: 'text', body: 'Removed' },
          { blockType: 'story', cols: [{ blockType: 'story-image', alt: 'Still editable' }] },
        ],
      },
    })
    const table = payload.db.tables.nested_block_pages_blocks_text

    await payload.db.drizzle
      .delete(table)
      .where(and(eq(table._parentID, doc.id), eq(table._order, 2)))
    const result = await payload.findByID({
      collection: pagesSlug,
      id: doc.id,
      overrideAccess: true,
    })

    expect(result.content).toEqual([
      expect.objectContaining({ body: 'First' }),
      expect.objectContaining({ cols: [expect.objectContaining({ alt: 'Still editable' })] }),
    ])
  })

  test('should persist dense block orders and preserve nested data from sparse adapter input', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: pagesSlug,
      overrideAccess: true,
      data: { content: [] },
    })
    const content: Record<string, unknown>[] = []
    content[0] = { id: '111111111111111111111111', blockType: 'text', body: 'First' }
    content[2] = {
      id: '222222222222222222222222',
      blockType: 'story',
      cols: [{ id: '333333333333333333333333', blockType: 'story-image', alt: 'Nested' }],
    }
    const req = await createPayloadRequest({ payload })

    await payload.db.updateOne({ collection: pagesSlug, id: doc.id, data: { content }, req })
    const table = payload.db.tables.nested_block_pages_blocks_story
    const rows = await payload.db.drizzle.select().from(table)

    expect(rows).toHaveLength(1)
    expect(rows[0]._order).toBe(2)
    const result = await payload.findByID({
      collection: pagesSlug,
      id: doc.id,
      overrideAccess: true,
    })
    expect(result.content).toEqual([
      expect.objectContaining({ body: 'First' }),
      expect.objectContaining({ cols: [expect.objectContaining({ alt: 'Nested' })] }),
    ])
  })
})
