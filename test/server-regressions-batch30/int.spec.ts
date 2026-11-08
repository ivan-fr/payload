import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { fieldsSlug, foldersSlug, publicSlug, restrictedSlug } from './slugs.js'

test.suite('read access isolation (#18331, #18332)', { config: './config.ts' }, () => {
  test('should skip hooks for unreadable fields and their children', async ({ payload }) => {
    const doc = await payload.create({
      overrideAccess: true,
      collection: fieldsSlug,
      data: {
        visible: 'Public',
        hidden: 'Hidden',
        denied: 'Denied',
        deniedGroup: { child: 'Private child' },
      },
    })
    const reads: string[] = []
    const result = await payload.findByID({
      collection: fieldsSlug,
      id: doc.id,
      overrideAccess: false,
      context: { reads },
    })
    expect(reads).toEqual(['visible'])
    expect(result).toMatchObject({ visible: 'Public' })
    expect(result).not.toHaveProperty('hidden')
    expect(result).not.toHaveProperty('denied')
    expect(result).not.toHaveProperty('deniedGroup')
    const internalReads: string[] = []
    await payload.findByID({
      collection: fieldsSlug,
      id: doc.id,
      overrideAccess: true,
      showHiddenFields: true,
      context: { reads: internalReads },
    })
    expect(internalReads.sort()).toEqual(['child', 'denied', 'hidden', 'visible'])
  })

  for (const denyBranch of [true, false]) {
    test(`should scope joined access to its target (denied: ${denyBranch})`, async ({
      payload,
    }) => {
      const folder = await payload.create({
        overrideAccess: true,
        collection: foldersSlug,
        data: {},
      })
      const readable = await payload.create({
        overrideAccess: true,
        collection: publicSlug,
        data: { title: 'Readable', folder: folder.id },
      })
      const permitted = await payload.create({
        overrideAccess: true,
        collection: restrictedSlug,
        data: { title: 'Allowed', visibility: 'public', folder: folder.id },
      })
      await payload.create({
        overrideAccess: true,
        collection: restrictedSlug,
        data: { title: 'Denied', visibility: 'private', folder: folder.id },
      })
      const result = await payload.findByID({
        collection: foldersSlug,
        id: folder.id,
        overrideAccess: false,
        context: { denyBranch },
        depth: 1,
        joins: { documents: { limit: 10 } },
      })
      expect(result.documents.docs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relationTo: publicSlug,
            value: expect.objectContaining({ id: readable.id }),
          }),
        ]),
      )
      expect(result.documents.docs).toHaveLength(denyBranch ? 1 : 2)
      expect(
        result.documents.docs
          .filter((doc) => doc.relationTo === restrictedSlug)
          .map((doc) => doc.value.id),
      ).toEqual(denyBranch ? [] : [permitted.id])
      const internal = await payload.findByID({
        collection: foldersSlug,
        id: folder.id,
        overrideAccess: true,
        depth: 1,
        joins: { documents: { limit: 10 } },
      })
      expect(internal.documents.docs).toHaveLength(3)
      const filtered = await payload.findByID({
        collection: foldersSlug,
        id: folder.id,
        overrideAccess: false,
        context: { denyBranch },
        depth: 1,
        joins: { documents: { where: { title: { equals: 'Readable' } }, limit: 10 } },
      })
      expect(filtered.documents.docs).toHaveLength(1)
      expect(filtered.documents.docs[0].relationTo).toBe(publicSlug)
    })
  }
  test('should persist long shipping addresses on the generated transaction schema (#19055)', async ({
    payload,
  }) => {
    const shippingAddress = { addressLine1: 'A'.repeat(450), addressLine2: 'B'.repeat(200) }
    const transaction = await payload.create({
      collection: 'transactions',
      overrideAccess: true,
      data: { amount: 1000, currency: 'USD', shippingAddress },
    })
    const found = await payload.findByID({
      collection: 'transactions',
      id: transaction.id,
      overrideAccess: true,
    })
    expect(found.shippingAddress).toMatchObject(shippingAddress)
  })
})
