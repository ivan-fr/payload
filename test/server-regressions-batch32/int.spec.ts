import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { pagesSlug } from './slugs.js'

test.suite('nested document child failures (#17457)', { config: './config.ts' }, () => {
  for (const isGrandchild of [false, true]) {
    test(`should reject a failed descendant save and respect transaction support (grandchild: ${isGrandchild})`, async ({
      payload,
    }) => {
      const transactionID = await payload.db.beginTransaction()
      const hasTransactions = transactionID !== null
      if (transactionID !== null) {
        await payload.db.rollbackTransaction(transactionID)
      }

      const parent = await payload.create({
        collection: pagesSlug,
        data: { title: 'Original parent' },
        overrideAccess: true,
      })
      const child = await payload.create({
        collection: pagesSlug,
        data: { title: 'Child', parent: parent.id },
        overrideAccess: true,
      })
      const failing = isGrandchild
        ? await payload.create({
            collection: pagesSlug,
            data: { title: 'Grandchild', parent: child.id },
            overrideAccess: true,
          })
        : child
      const before = await payload.findByID({
        collection: pagesSlug,
        id: parent.id,
        overrideAccess: true,
      })
      await expect(
        payload.update({
          collection: pagesSlug,
          id: parent.id,
          data: { title: 'Rejected parent' },
          context: { failChildID: failing.id },
          overrideAccess: true,
        }),
      ).rejects.toMatchObject({ message: 'Child save was rejected', status: 409 })
      const stored = await payload.findByID({
        collection: pagesSlug,
        id: parent.id,
        overrideAccess: true,
      })
      expect(stored).toMatchObject({
        title: hasTransactions ? 'Original parent' : 'Rejected parent',
        ...(hasTransactions ? { updatedAt: before.updatedAt } : {}),
      })
      const storedChild = await payload.findByID({
        collection: pagesSlug,
        id: child.id,
        overrideAccess: true,
      })
      expect(storedChild.breadcrumbs?.map(({ label }) => label)).toEqual([
        hasTransactions || !isGrandchild ? 'Original parent' : 'Rejected parent',
        'Child',
      ])
      const rejected = isGrandchild
        ? await payload.findByID({ collection: pagesSlug, id: failing.id, overrideAccess: true })
        : storedChild
      expect(rejected.breadcrumbs?.map(({ label }) => label)).toEqual(
        isGrandchild ? ['Original parent', 'Child', 'Grandchild'] : ['Original parent', 'Child'],
      )
    })
  }
  test('should still persist a valid parent change and refresh child breadcrumbs', async ({
    payload,
  }) => {
    const parent = await payload.create({
      collection: pagesSlug,
      data: { title: 'Original' },
      overrideAccess: true,
    })
    const child = await payload.create({
      collection: pagesSlug,
      data: { title: 'Child', parent: parent.id },
      overrideAccess: true,
    })
    await payload.update({
      collection: pagesSlug,
      id: parent.id,
      data: { title: 'Updated' },
      overrideAccess: true,
    })
    const stored = await payload.findByID({
      collection: pagesSlug,
      id: child.id,
      overrideAccess: true,
    })
    expect(stored.breadcrumbs?.map(({ label }) => label)).toEqual(['Updated', 'Child'])
  })
})
