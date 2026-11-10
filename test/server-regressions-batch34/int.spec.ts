import { createPayloadRequest } from 'payload'
import { expect, vi } from 'vitest'

import { createExport } from '../../packages/plugin-import-export/src/export/createExport.js'
import { parseCSV } from '../../packages/plugin-import-export/src/utilities/parseCSV.js'
import { test } from '../__helpers/int/vitest.js'
import { articlesSlug, peopleSlug } from './slugs.js'

test.suite('batch 34 server regressions', { config: './config.ts' }, () => {
  test('should populate flattened localized groups and named tabs for live preview', async ({
    payload,
  }) => {
    const owner = await payload.create({
      collection: peopleSlug,
      data: { name: 'Owner' },
      overrideAccess: true,
    })
    const section = { mode: 'plain', owner: owner.id, items: [{ label: 'First' }] }
    const article = await payload.create({
      collection: articlesSlug,
      data: { hero: section, details: section },
      locale: 'en',
      depth: 0,
      overrideAccess: true,
    })
    const preview = await payload.findByID({
      collection: articlesSlug,
      id: article.id,
      data: article,
      flattenLocales: false,
      depth: 1,
      locale: 'en',
      overrideAccess: true,
    })

    expect(preview.hero).toMatchObject({
      mode: 'plain',
      owner: { id: owner.id, name: 'Owner' },
      items: [{ label: 'First' }],
    })
    expect(preview.details).toMatchObject({
      mode: 'plain',
      owner: { id: owner.id },
      items: [{ label: 'First' }],
    })
    const all = await payload.findByID({
      collection: articlesSlug,
      id: article.id,
      locale: 'all',
      depth: 1,
      overrideAccess: true,
    })

    expect(all.hero.en.owner).toMatchObject({ id: owner.id })
    expect(all.details.en.items).toHaveLength(1)
  })

  test.options(
    'should combine predicates on the same block without duplicate table joins',
    { db: 'drizzle' },
    async ({ payload }) => {
      const owner = await payload.create({
        collection: peopleSlug,
        data: { name: 'Owner' },
        overrideAccess: true,
      })
      const article = await payload.create({
        collection: articlesSlug,
        data: {
          _status: 'published',
          layout: [
            {
              blockType: 'text',
              heading: 'Needle',
              caption: 'Other',
              owner: owner.id,
              reviewer: owner.id,
            },
          ],
        },
        overrideAccess: true,
      })
      const heading = { 'layout.heading': { equals: 'Needle' } }
      const caption = { 'layout.caption': { equals: 'Other' } }
      for (const where of [
        heading,
        caption,
        { or: [heading, caption] },
        { and: [heading, caption] },
        {
          and: [
            { 'layout.owner.name': { equals: 'Owner' } },
            { 'layout.reviewer.name': { equals: 'Owner' } },
          ],
        },
      ]) {
        const result = await payload.find({
          collection: articlesSlug,
          where,
          depth: 0,
          overrideAccess: true,
        })

        expect(result.docs.map(({ id }) => id)).toEqual([article.id])
      }
    },
  )

  test('should only return localized defaults in locales that have been written', async ({
    payload,
  }) => {
    const article = await payload.create({
      collection: articlesSlug,
      data: {},
      locale: 'en',
      overrideAccess: true,
    })

    expect(article.localizedDefault).toBe('default-en')
    const french = await payload.findByID({
      collection: articlesSlug,
      id: article.id,
      locale: 'fr',
      fallbackLocale: false,
      overrideAccess: true,
    })

    expect(french.localizedDefault).toBeUndefined()
    expect(french.plainDefault).toBe('plain')
  })
  test('should retain one latest version when timestamps tie and an older write finishes later', async ({
    payload,
  }) => {
    const article = await payload.create({
      collection: articlesSlug,
      data: {},
      overrideAccess: true,
    })
    const write = ({ updatedAt }: { updatedAt: string }) =>
      payload.db.createVersion({
        collectionSlug: articlesSlug,
        parent: article.id,
        createdAt: updatedAt,
        updatedAt,
        versionData: { _status: 'draft', plainDefault: updatedAt },
      })
    const timestamp = '2099-01-01T00:00:00.000Z'
    const first = await write({ updatedAt: timestamp })
    const second = await write({ updatedAt: timestamp })
    const older = await write({ updatedAt: '2098-01-01T00:00:00.000Z' })
    const versions = await payload.findVersions({
      collection: articlesSlug,
      where: { and: [{ parent: { equals: article.id } }, { latest: { equals: true } }] },
      overrideAccess: true,
    })

    expect(versions.docs).toHaveLength(1)
    expect([first.id, second.id]).toContain(versions.docs[0].id)
    expect(older.latest).toBeFalsy()
    const latestID = versions.docs[0].id
    const more = await Promise.all([
      write({ updatedAt: timestamp }),
      write({ updatedAt: timestamp }),
    ])
    const concurrent = await payload.findVersions({
      collection: articlesSlug,
      where: { and: [{ parent: { equals: article.id } }, { latest: { equals: true } }] },
      overrideAccess: true,
    })

    expect(concurrent.docs).toHaveLength(1)
    expect([latestID, ...more.map(({ id }) => id)]).toContain(concurrent.docs[0].id)
  })

  test('should preserve later-batch CSV array items and call export hooks once per batch', async ({
    payload,
  }) => {
    for (const [sortOrder, labels] of [['a'], ['b', 'c', 'd']].entries()) {
      await payload.create({
        collection: articlesSlug,
        data: { _status: 'published', sortOrder, items: labels.map((label) => ({ label })) },
        overrideAccess: true,
      })
    }
    const user = (await payload.find({ collection: 'users', overrideAccess: true })).docs[0]
    const req = await createPayloadRequest({ payload, user: { ...user, collection: 'users' } })
    const config = payload.collections[articlesSlug].config
    const originalCustom = config.custom
    const before = vi.fn(({ data }) => data.map((row) => ({ ...row, extra: 'hook' })))
    const after = vi.fn()
    config.custom = {
      ...originalCustom,
      'plugin-import-export': { exportHooks: { before, after } },
    }
    try {
      const response = await createExport({
        collectionSlug: articlesSlug,
        batchSize: 1,
        download: true,
        exportCollection: 'unused',
        exportDoc: {} as never,
        format: 'csv',
        id: 'download',
        name: 'batch34',
        sort: 'sortOrder',
        req,
      })

      if (!(response instanceof Response)) {
        throw new Error('Expected a download response')
      }
      const rows = await parseCSV({ data: await response.text(), req })

      expect(rows).toHaveLength(2)
      expect(rows[0].items_2_label).toBeUndefined()
      expect(rows[1]).toMatchObject({
        items_0_label: 'b',
        items_1_label: 'c',
        items_2_label: 'd',
        extra: 'hook',
      })
      expect(before).toHaveBeenCalledTimes(2)
      expect(after).toHaveBeenCalledTimes(2)
      expect(req.file).toBeUndefined()
    } finally {
      config.custom = originalCustom
    }
  })
  test('should apply localized defaults on a later write and preserve fallback reads', async ({
    payload,
  }) => {
    const article = await payload.create({
      collection: articlesSlug,
      data: {},
      locale: 'en',
      overrideAccess: true,
    })
    const fallback = await payload.findByID({
      collection: articlesSlug,
      id: article.id,
      locale: 'fr',
      fallbackLocale: 'en',
      overrideAccess: true,
    })

    expect(fallback.localizedDefault).toBe('default-en')
    const written = await payload.update({
      collection: articlesSlug,
      id: article.id,
      data: {},
      locale: 'fr',
      overrideAccess: true,
    })

    expect(written.localizedDefault).toBe('default-fr')
    const all = await payload.findByID({
      collection: articlesSlug,
      id: article.id,
      locale: 'all',
      overrideAccess: true,
    })

    expect(all.localizedDefault).toEqual({ en: 'default-en', fr: 'default-fr' })
  })

  test('should keep CSV limits and empty headers and stream complete JSON downloads', async ({
    payload,
  }) => {
    for (const [sortOrder, labels] of [['one'], ['two', 'three']].entries()) {
      await payload.create({
        collection: articlesSlug,
        data: { _status: 'published', sortOrder, items: labels.map((label) => ({ label })) },
        overrideAccess: true,
      })
    }
    const user = (await payload.find({ collection: 'users', overrideAccess: true })).docs[0]
    const req = await createPayloadRequest({ payload, user: { ...user, collection: 'users' } })
    const download = async (options: {
      format: 'csv' | 'json'
      limit?: number
      where?: Record<string, unknown>
    }) => {
      const response = await createExport({
        collectionSlug: articlesSlug,
        batchSize: 1,
        download: true,
        exportCollection: 'unused',
        exportDoc: {} as never,
        id: 'download',
        name: 'batch34',
        sort: 'sortOrder',
        req,
        ...options,
      })
      if (!(response instanceof Response)) {
        throw new Error('Expected a download response')
      }
      return response
    }
    const limited = await parseCSV({
      data: await (await download({ format: 'csv', limit: 1 })).text(),
      req,
    })

    expect(limited).toHaveLength(1)
    expect(Object.keys(limited[0])).not.toContain('items_1_label')
    const empty = await (
      await download({ format: 'csv', where: { plainDefault: { equals: 'missing' } } })
    ).text()

    expect(empty).toContain('id')
    expect(await parseCSV({ data: empty, req })).toEqual([])
    const json = await (await download({ format: 'json' })).json()

    expect(json.map(({ items }) => items.map(({ label }) => label))).toEqual([
      ['one'],
      ['two', 'three'],
    ])
    await expect(download({ format: 'csv', limit: -1 })).rejects.toThrow()
  })
})
