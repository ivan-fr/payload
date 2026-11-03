import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { categoriesSlug, postsSlug, versionsSlug } from './shared.js'

test.suite('Multi-key join sorting (#18258)', { config: './config.ts' }, () => {
  test('should honor the second sort key in an ordinary join before pagination', async ({
    payload,
  }) => {
    const category = await payload.create({
      collection: categoriesSlug,
      data: { name: 'Multi-sort' },
      overrideAccess: true,
    })
    for (const title of ['Zulu', 'Alpha', 'Mike']) {
      await payload.create({
        collection: postsSlug,
        data: { title, category: category.id, isFiltered: false },
        overrideAccess: true,
      })
    }
    const result = await payload.findByID({
      collection: categoriesSlug,
      id: category.id,
      overrideAccess: true,
      depth: 1,
      joins: { relatedPosts: { sort: ['isFiltered', 'title'], limit: 2 } },
    })

    expect(
      result.relatedPosts?.docs?.map((doc) => (typeof doc === 'object' ? doc.title : doc)),
    ).toEqual(['Alpha', 'Mike'])
    expect(result.relatedPosts?.hasNextPage).toBe(true)
  })

  test.options(
    'should merge polymorphic join results using every sort key',
    { db: (adapter) => adapter === 'mongodb' || adapter === 'mongodb-atlas' },
    async ({ payload }) => {
      const category = await payload.create({
        collection: categoriesSlug,
        data: { name: 'Polymorphic multi-sort' },
        overrideAccess: true,
      })
      await payload.create({
        collection: postsSlug,
        data: { title: 'Zulu', category: category.id },
        overrideAccess: true,
      })
      await payload.create({
        collection: versionsSlug,
        data: { title: 'Alpha', category: category.id, _status: 'published' },
        overrideAccess: true,
      })
      await payload.create({
        collection: postsSlug,
        data: { title: 'Mike', category: category.id },
        overrideAccess: true,
      })
      const result = await payload.findByID({
        collection: categoriesSlug,
        id: category.id,
        overrideAccess: true,
        depth: 1,
        joins: { polymorphicJoin: { sort: ['category', 'title'], limit: 2 } },
      })

      expect(
        result.polymorphicJoin?.docs?.map((doc) =>
          typeof doc.value === 'object' ? doc.value.title : doc.value,
        ),
      ).toEqual(['Alpha', 'Mike'])
      expect(result.polymorphicJoin?.hasNextPage).toBe(true)
    },
  )
})
