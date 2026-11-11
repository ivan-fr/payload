import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { contextSlug, defaultsSlug, namesSlug } from './slugs.js'

test.suite('batch 36 server regressions', { config: './config.ts' }, () => {
  test('should assign distinct row IDs for callback defaults across repeated draft creates', async ({
    payload,
  }) => {
    const first = await payload.create({
      collection: defaultsSlug,
      data: { title: 'First' },
      draft: true,
    })
    const second = await payload.create({
      collection: defaultsSlug,
      data: { title: 'Second' },
      draft: true,
    })
    const rows = [...first.items!, ...second.items!]

    expect(rows).toHaveLength(8)
    expect(new Set(rows.map(({ id }) => id)).size).toBe(8)
    expect(rows.every(({ label }) => label === 'Default')).toBe(true)
    const saved = await payload.findByID({ collection: defaultsSlug, id: first.id, draft: true })

    expect(saved.items).toEqual(first.items)
  })

  test('should keep nested read context out of every outer document hook', async ({ payload }) => {
    await payload.create({ collection: contextSlug, data: { title: 'First' } })
    await payload.create({ collection: contextSlug, data: { title: 'Second' } })
    const result = await payload.find({
      collection: contextSlug,
      context: { probe: true },
      depth: 0,
    })

    expect(result.docs).toHaveLength(2)
    expect(result.docs.map(({ leaked }) => leaked)).toEqual([false, false])
  })

  test('should populate related documents using the nested context without poisoning the parent loader', async ({
    payload,
  }) => {
    const owner = await payload.create({ collection: namesSlug, data: {} })
    const doc = await payload.create({ collection: contextSlug, data: { owner: owner.id } })
    const req = await createPayloadRequest({ payload, context: { marker: 'outer' } })
    const args = { collection: contextSlug, id: doc.id, depth: 1, req } as const
    const outer = await payload.findByID(args)
    const inner = await payload.findByID({ ...args, context: { marker: 'inner' } })
    const outerAgain = await payload.findByID(args)

    expect(outer.owner).toMatchObject({ observedContext: 'outer' })
    expect(inner.owner).toMatchObject({ observedContext: 'inner' })
    expect(outerAgain.owner).toMatchObject({ observedContext: 'outer' })
    expect(req.context.marker).toBe('outer')
  })

  test('should respect transaction support for nested writes when context is overridden', async ({
    payload,
  }) => {
    const transactionID = await payload.db.beginTransaction()
    const hasTransactions = transactionID !== null
    if (transactionID !== null) {
      await payload.db.rollbackTransaction(transactionID)
    }
    const target = await payload.create({ collection: contextSlug, data: { title: 'Original' } })

    await expect(
      payload.create({
        collection: contextSlug,
        data: { title: 'Fails' },
        context: { failAfterNestedWrite: true, targetID: target.id },
      }),
    ).rejects.toThrow('Rollback parent and nested write')
    const saved = await payload.findByID({ collection: contextSlug, id: target.id })

    expect(saved.title).toBe(hasTransactions ? 'Original' : 'Must roll back')
    expect((await payload.count({ collection: contextSlug })).totalDocs).toBe(1)
  })
})
