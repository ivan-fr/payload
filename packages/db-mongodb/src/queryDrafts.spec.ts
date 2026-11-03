import type { Sort } from 'payload'

import { sanitizeConfig } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { MongooseAdapter } from './index.js'

import { queryDrafts } from './queryDrafts.js'

describe('draft default sort (#19184)', () => {
  it.each([
    ['-title', undefined, { 'version.title': 'desc', createdAt: 'desc' }],
    [['title', '-id'], undefined, { 'version.title': 'asc', parent: 'desc', createdAt: 'desc' }],
    [undefined, undefined, { 'version.createdAt': 'desc', createdAt: 'desc' }],
    ['-title', ['version.title'], { 'version.title': 'asc', createdAt: 'desc' }],
  ] as [Sort | undefined, Sort | undefined, Record<string, string>][])(
    'should use version paths for default %j and preserve explicit %j',
    async (defaultSort, sort, expected) => {
      const config = sanitizeConfig({
        secret: 'test',
        collections: [
          {
            slug: 'posts',
            defaultSort,
            versions: { drafts: true },
            fields: [{ name: 'title', type: 'text' }],
          },
        ],
      })
      const collectionConfig = config.collections.find(({ slug }) => slug === 'posts')!
      const paginate = vi.fn().mockResolvedValue({ docs: [] })
      const adapter = {
        disableFallbackSort: false,
        useJoinAggregations: false,
        payload: { config, collections: { posts: { config: collectionConfig } } },
        versions: { posts: { paginate } },
      } as unknown as MongooseAdapter

      await queryDrafts.call(adapter, { collection: 'posts', limit: 1, pagination: false, sort })
      expect(paginate).toHaveBeenCalledOnce()
      expect(paginate.mock.calls[0][1].sort).toEqual(expected)
    },
  )
})
