import type { Payload, PayloadRequest } from 'payload'

import { parse } from 'csv-parse/sync'
import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import type { CreateExportArgs } from '../../packages/plugin-import-export/src/export/createExport.js'

import { createExport } from '../../packages/plugin-import-export/src/export/createExport.js'
import { test } from '../__helpers/int/vitest.js'
import { hookCalls } from './hookCalls.js'
import { postsSlug, usersSlug } from './slugs.js'

test.suite('CSV downloads across batches (#19140)', { config: './config.ts' }, () => {
  test.beforeEach(() => {
    hookCalls.after.length = 0
    hookCalls.before.length = 0
    hookCalls.field.length = 0
  })

  test('should retain every array item from later batches and invoke hooks once', async ({
    payload,
  }) => {
    const req = await prepare({ payload })
    const response = await download({ req })
    const csv = await response.text()
    const rows = parse(csv, { bom: true, columns: true })

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      items_0_label: 'a',
      items_1_label: '',
      items_2_label: '',
      title: 'First',
    })
    expect(rows[2]).toMatchObject({
      items_0_label: 'a',
      items_1_label: 'b',
      items_2_label: 'c',
      title: 'Last',
    })
    expect(Object.keys(rows[0])).not.toContain('secret')
    expect(hookCalls.before).toEqual([1, 2, 3])
    expect(hookCalls.after).toEqual([1, 2, 3])
    expect(hookCalls.field).toEqual(['First', 'Middle', 'Last'])
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
  })

  test('should include late hook columns while honoring fields removed by hooks', async ({
    payload,
  }) => {
    const req = await prepare({ payload })
    const response = await download({ req, exportDoc: { addColumns: true } })
    const rows = parse(await response.text(), { bom: true, columns: true })

    expect(Object.keys(rows[0])).not.toContain('title')
    expect(rows[0]).toMatchObject({ batch_1: 'First', batch_2: '', batch_3: '' })
    expect(rows[2]).toMatchObject({ batch_1: '', batch_2: '', batch_3: 'Last' })
  })

  test('should discover columns even when a hook filters out the first batch', async ({
    payload,
  }) => {
    const req = await prepare({ payload })
    const response = await download({ req, exportDoc: { addColumns: true, skipFirstBatch: true } })
    const rows = parse(await response.text(), { bom: true, columns: true })

    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ batch_3: 'Last', items_2_label: 'c' })
    expect(hookCalls.before).toEqual([1, 2, 3])
    expect(hookCalls.after).toEqual([2, 3])
  })

  test('should discover columns only within the requested page and export ceiling', async ({
    payload,
  }) => {
    const req = await prepare({ payload })
    const response = await download({ req, limit: 5, maxLimit: 1, page: 2 })
    const rows = parse(await response.text(), { bom: true, columns: true })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ items_1_label: 'b', title: 'Middle' })
    expect(Object.keys(rows[0])).not.toContain('items_2_label')
    expect(hookCalls.field).toEqual(['Middle'])
  })

  test('should retain all array items in JSON downloads', async ({ payload }) => {
    const req = await prepare({ payload })
    const response = await download({ req, format: 'json' })
    const rows = await response.json()

    expect(rows).toHaveLength(3)
    expect(rows[2].items.map(({ label }: { label: string }) => label)).toEqual(['a', 'b', 'c'])
  })

  test('should respect read access and emit only headers for an unauthorized user', async ({
    payload,
  }) => {
    const req = await prepare({ payload })

    req.user = { ...req.user!, collection: usersSlug, id: 999999 }
    const collection = payload.collections[postsSlug].config
    const originalRead = collection.access.read

    collection.access.read = () => false
    try {
      const response = await download({ req })
      const rows = parse(await response.text(), { bom: true, columns: true })

      expect(rows).toEqual([])
      expect(hookCalls.field).toEqual([])
    } finally {
      collection.access.read = originalRead
    }
  })
})

async function prepare({ payload }: { payload: Payload }): Promise<PayloadRequest> {
  const user = await payload.create({
    collection: usersSlug,
    data: { email: 'csv@example.com', password: 'test' },
    overrideAccess: true,
  })

  for (const [index, title] of ['First', 'Middle', 'Last'].entries()) {
    await payload.create({
      collection: postsSlug,
      data: {
        _status: 'published',
        title,
        secret: 'private',
        items: ['a', 'b', 'c'].slice(0, index + 1).map((label) => ({ label })),
      },
      overrideAccess: true,
    })
  }

  return createPayloadRequest({ payload, user: { ...user, collection: usersSlug } })
}

async function download(
  args: { req: PayloadRequest } & Partial<CreateExportArgs>,
): Promise<Response> {
  const response = await createExport({
    id: 'download',
    name: 'batch30',
    batchSize: 1,
    collectionSlug: postsSlug,
    download: true,
    exportCollection: 'exports',
    exportDoc: {},
    format: 'csv',
    sort: 'id',
    ...args,
  })

  if (!(response instanceof Response)) {
    throw new Error('Expected a download response')
  }

  return response
}
