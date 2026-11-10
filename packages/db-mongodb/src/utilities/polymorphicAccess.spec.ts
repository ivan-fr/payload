import type { SanitizedCollectionConfig } from 'payload'

import { describe, expect, it } from 'vitest'

import type { MongooseAdapter } from '../index.js'

import { buildJoinAggregation } from './buildJoinAggregation.js'

describe('MongoDB aggregation join access (#18332)', () => {
  it('should preserve branch access restrictions in the native aggregation pipeline', async () => {
    const targetFields = [
      { name: 'folder', type: 'relationship', relationTo: 'folders' },
      { name: 'visibility', type: 'text' },
    ]
    const targets = ['media', 'private']
    const join = {
      joinPath: 'documents',
      field: { collection: targets, on: 'folder', defaultLimit: 10 },
    }
    const collectionConfig = {
      slug: 'folders',
      joins: {},
      polymorphicJoins: [join],
      flattenedFields: [],
    } as unknown as SanitizedCollectionConfig
    const collections = Object.fromEntries(
      targets.map((slug) => [
        slug,
        { config: { slug, flattenedFields: targetFields, fields: targetFields, versions: false } },
      ]),
    )
    const adapter = {
      useJoinAggregations: true,
      collections: Object.fromEntries(
        targets.map((slug) => [slug, { collection: { name: slug } }]),
      ),
      payload: {
        collections: { ...collections, folders: { config: collectionConfig } },
        config: { localization: false },
      },
    } as unknown as MongooseAdapter
    const where = {
      or: [{ relationTo: { not_equals: 'private' } }, { visibility: { equals: 'public' } }],
    }
    const pipeline = await buildJoinAggregation({
      adapter,
      collection: 'folders',
      collectionConfig,
      joins: { documents: { where } },
    })
    const lookup = pipeline.find((stage) => '$lookup' in stage) as {
      $lookup: { pipeline: Record<string, any>[] }
    }
    expect(lookup.$lookup.pipeline[0]).toEqual({
      $addFields: { relationTo: { $literal: 'media' } },
    })
    expect(lookup.$lookup.pipeline[1].$match.$and[1].$or[0]).toEqual({
      relationTo: { $ne: 'private' },
    })
  })
})
