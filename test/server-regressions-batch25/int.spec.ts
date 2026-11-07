import { expect } from 'vitest'

import type { NestedBlockPage } from './payload-types.js'

import { test } from '../__helpers/int/vitest.js'
import { pagesSlug } from './slugs.js'

test.suite('nested block cleanup (#19322)', { config: './config.ts', db: 'drizzle' }, () => {
  test('should retain nested blocks in other documents and surviving siblings', async ({
    payload,
  }) => {
    const data = {
      content: [
        { blockType: 'story', cols: [{ blockType: 'story-image', alt: 'First' }] },
        { blockType: 'story', cols: [{ blockType: 'story-image', alt: 'Surviving' }] },
      ],
    } satisfies Pick<NestedBlockPage, 'content'>
    const first = await payload.create({ collection: pagesSlug, overrideAccess: true, data })
    const other = await payload.create({ collection: pagesSlug, overrideAccess: true, data })

    await payload.update({
      collection: pagesSlug,
      id: first.id,
      overrideAccess: true,
      data: {
        content: [{ blockType: 'grid', cols: [] }, data.content[1]!],
      },
    })
    const result = await payload.findByID({
      collection: pagesSlug,
      id: first.id,
      overrideAccess: true,
    })
    const untouched = await payload.findByID({
      collection: pagesSlug,
      id: other.id,
      overrideAccess: true,
    })

    expect(result.content).toEqual([
      expect.objectContaining({ cols: [] }),
      expect.objectContaining({ cols: [expect.objectContaining({ alt: 'Surviving' })] }),
    ])
    expect(untouched.content).toEqual([
      expect.objectContaining({ cols: [expect.objectContaining({ alt: 'First' })] }),
      expect.objectContaining({ cols: [expect.objectContaining({ alt: 'Surviving' })] }),
    ])
  })

  test('should remove nested rows when replacing their last parent block', async ({ payload }) => {
    const doc = await payload.create({
      collection: pagesSlug,
      overrideAccess: true,
      data: {
        content: [
          { blockType: 'text', body: 'Intro' },
          { blockType: 'story', cols: [{ blockType: 'story-image', alt: 'Old' }] },
        ],
      },
    })

    await payload.update({
      collection: pagesSlug,
      id: doc.id,
      overrideAccess: true,
      data: {
        content: [
          { blockType: 'text', body: 'Intro' },
          { blockType: 'grid', cols: [{ blockType: 'image', alt: 'New' }] },
        ],
      },
    })
    const result = await payload.findByID({
      collection: pagesSlug,
      id: doc.id,
      overrideAccess: true,
    })

    expect(result.content?.[1]).toEqual(
      expect.objectContaining({
        cols: [expect.objectContaining({ blockType: 'image', alt: 'New' })],
      }),
    )
  })

  test('should not resurrect nested rows after removing their parent and reusing its path', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: pagesSlug,
      overrideAccess: true,
      data: {
        content: [{ blockType: 'story', cols: [{ blockType: 'story-image', alt: 'Deleted' }] }],
      },
    })

    await payload.update({
      collection: pagesSlug,
      id: doc.id,
      overrideAccess: true,
      data: { content: [] },
    })
    await payload.update({
      collection: pagesSlug,
      id: doc.id,
      overrideAccess: true,
      data: { content: [{ blockType: 'grid', cols: [] }] },
    })
    const result = await payload.findByID({
      collection: pagesSlug,
      id: doc.id,
      overrideAccess: true,
    })

    expect(result.content?.[0]).toEqual(expect.objectContaining({ cols: [] }))
  })
})
