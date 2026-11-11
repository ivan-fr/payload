import { expect } from 'vitest'

import { test } from '../../__helpers/int/vitest.js'
import { uuidDocumentsSlug, uuidGroupsSlug } from '../slugs.js'

test.suite(
  'empty UUID relationship access (#16195)',
  { config: './config.ts', db: (adapter) => adapter.startsWith('sqlite') },
  () => {
    test('should deny every document when read access returns in []', async ({ payload }) => {
      const group = await payload.create({
        collection: uuidGroupsSlug,
        data: {},
        overrideAccess: true,
      })

      await payload.create({
        collection: uuidDocumentsSlug,
        data: { permissions: [{ entity: { relationTo: uuidGroupsSlug, value: group.id } }] },
        overrideAccess: true,
        depth: 0,
      })
      await payload.create({ collection: uuidDocumentsSlug, data: {}, overrideAccess: true })
      const result = await payload.find({
        collection: uuidDocumentsSlug,
        context: { emptyAccess: true },
        overrideAccess: false,
        depth: 0,
      })

      expect(result.docs).toEqual([])
      expect(result.totalDocs).toBe(0)
    })

    test('should preserve nonempty matches and the empty not_in identity', async ({ payload }) => {
      const group = await payload.create({
        collection: uuidGroupsSlug,
        data: {},
        overrideAccess: true,
      })
      const doc = await payload.create({
        collection: uuidDocumentsSlug,
        data: { permissions: [{ entity: { relationTo: uuidGroupsSlug, value: group.id } }] },
        overrideAccess: true,
        depth: 0,
      })
      const other = await payload.create({
        collection: uuidDocumentsSlug,
        data: {},
        overrideAccess: true,
      })
      const positive = await payload.find({
        collection: uuidDocumentsSlug,
        where: { 'permissions.entity.value': { in: [group.id] } },
        overrideAccess: false,
        depth: 0,
      })
      const negative = await payload.find({
        collection: uuidDocumentsSlug,
        where: { 'permissions.entity.value': { not_in: [] } },
        overrideAccess: false,
        depth: 0,
      })

      expect(positive.docs.map(({ id }) => id)).toEqual([doc.id])
      expect(negative.docs.map(({ id }) => id).sort()).toEqual([doc.id, other.id].sort())
    })
  },
)
