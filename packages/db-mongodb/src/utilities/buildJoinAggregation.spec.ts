import type { MongooseAdapter } from '../index.js'
import type { SanitizedCollectionConfig } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { findDocumentsInputSchema } from 'payload'
import { buildJoinAggregation } from './buildJoinAggregation.js'

vi.mock('../queries/buildQuery.js', () => ({ buildQuery: vi.fn().mockResolvedValue({}) }))

function fixture({ polymorphic = false, fallback = false } = {}) {
  const fields = [
    { name: 'featured', type: 'checkbox' },
    { name: 'name', type: 'text' },
  ]
  const childConfig = {
    slug: 'children',
    flattenedFields: fields,
    defaultSort: ['-featured', 'name'],
    versions: false,
  }
  const join = {
    joinPath: 'children',
    field: {
      collection: polymorphic ? ['children', 'others'] : 'children',
      on: 'parent',
      defaultSort: ['-featured', 'name'],
    },
    targetField: { relationTo: 'parents' },
  }
  const collectionConfig = {
    slug: 'parents',
    joins: polymorphic ? {} : { children: [join] },
    polymorphicJoins: polymorphic ? [join] : [],
  } as unknown as SanitizedCollectionConfig
  const model = { collection: { name: 'children' }, buildQuery: vi.fn().mockResolvedValue({}) }
  const adapter = {
    useJoinAggregations: true,
    disableFallbackSort: !fallback,
    collections: { children: model, others: model },
    payload: {
      config: { localization: false },
      collections: {
        parents: { config: collectionConfig },
        children: { config: childConfig },
        others: { config: childConfig },
      },
    },
  } as unknown as MongooseAdapter
  return { adapter, collectionConfig, collection: 'parents' }
}

describe('MongoDB multi-key join sorts (#18258)', () => {
  it.each([false, true])(
    'should retain every sort key before limiting join results (polymorphic: %s)',
    async (polymorphic) => {
      const stages = await buildJoinAggregation(fixture({ polymorphic }))
      const lookups = stages.filter((stage) => '$lookup' in stage)
      expect(lookups).toHaveLength(polymorphic ? 2 : 1)
      for (const stage of lookups) {
        const pipeline = '$lookup' in stage ? stage.$lookup.pipeline! : []
        expect(pipeline.find((stage) => '$sort' in stage)).toEqual({
          $sort: { featured: -1, name: 1 },
        })
        if (polymorphic)
          expect(pipeline.find((stage) => '$project' in stage)).toEqual({
            $project: { value: '$_id', featured: 1, name: 1, relationTo: 1 },
          })
      }
      if (polymorphic)
        expect(stages.find((stage) => '$set' in stage && 'children.docs' in stage.$set)).toEqual({
          $set: {
            'children.docs': {
              $sortArray: { input: '$children.docs', sortBy: { featured: -1, name: 1 } },
            },
          },
        })
    },
  )

  it('should retain the deterministic fallback sort too', async () => {
    const stages = await buildJoinAggregation(fixture({ fallback: true }))
    const lookup = stages.find((stage) => '$lookup' in stage)!
    expect(
      '$lookup' in lookup && lookup.$lookup.pipeline!.find((stage) => '$sort' in stage),
    ).toEqual({ $sort: { featured: -1, name: 1, createdAt: -1 } })
  })

  it('should accept multi-key query sort arrays through the strict API schema', () => {
    expect(
      findDocumentsInputSchema.safeParse({
        slug: 'parents',
        joins: { children: { sort: ['-featured', 'name'] } },
      }).success,
    ).toBe(true)
  })
})

describe('MongoDB has-many polymorphic joins (#18814)', () => {
  it('should match the root ID in array or scalar relationships in every lookup', async () => {
    const stages = await buildJoinAggregation(fixture({ polymorphic: true }))
    const lookups = stages.filter((stage) => '$lookup' in stage)
    expect(lookups).toHaveLength(2)
    for (const lookup of lookups) {
      expect(
        '$lookup' in lookup && lookup.$lookup.pipeline!.find((stage) => '$match' in stage),
      ).toEqual({
        $match: {
          $and: [
            {
              $expr: {
                $in: ['$$root_id_', { $cond: [{ $isArray: '$parent' }, '$parent', ['$parent']] }],
              },
            },
            {},
          ],
        },
      })
    }
  })
})
