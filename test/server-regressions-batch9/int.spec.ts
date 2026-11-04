import type { DrizzleAdapter } from '@payloadcms/drizzle'

import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, vi } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { getTransaction } from '../../packages/drizzle/src/utilities/getTransaction.js'
import { labelsSlug, mediaSlug, postsSlug, settingsSlug } from './slugs.js'

test.suite('Server regressions batch 9', { config: './config.ts' }, () => {
  test.afterEach(async ({ payload }) => {
    const upload = payload.collections[mediaSlug]!.config.upload
    if (upload && typeof upload === 'object')
      await fs.rm(upload.staticDir!, { recursive: true, force: true })
  })

  test('should preserve business-field overrides when duplicating an uploaded file (#17762)', async ({
    payload,
  }) => {
    const bytes = Buffer.from('Original file content')
    const source = await payload.create({
      collection: mediaSlug,
      overrideAccess: true,
      data: { owner: 'source', description: 'Preserve this' },
      file: { data: bytes, mimetype: 'text/plain', name: 'original.txt', size: bytes.length },
    })
    const duplicate = await payload.duplicate({
      collection: mediaSlug,
      id: source.id,
      overrideAccess: true,
      data: { owner: 'destination' },
    })

    expect(duplicate.owner).toBe('destination')
    expect(duplicate.description).toBe('Preserve this')
    expect(duplicate.id).not.toBe(source.id)
    expect(duplicate.filename).not.toBe(source.filename)
    const persisted = await payload.findByID({
      collection: mediaSlug,
      id: duplicate.id,
      overrideAccess: true,
    })
    expect(persisted.owner).toBe('destination')
    const original = await payload.findByID({
      collection: mediaSlug,
      id: source.id,
      overrideAccess: true,
    })
    expect(original.owner).toBe('source')
    const upload = payload.collections[mediaSlug]!.config.upload
    if (!upload || typeof upload !== 'object') throw new Error('Expected upload config')
    expect(await fs.readFile(path.join(upload.staticDir!, duplicate.filename!))).toEqual(bytes)
  })

  test('should preserve overrides on upload documents without a file (#17762)', async ({
    payload,
  }) => {
    const source = await payload.create({
      collection: mediaSlug,
      overrideAccess: true,
      data: { owner: 'source', description: 'Preserve this' },
    })
    const duplicate = await payload.duplicate({
      collection: mediaSlug,
      id: source.id,
      overrideAccess: true,
      data: { owner: 'destination' },
    })

    expect(duplicate.owner).toBe('destination')
    expect(duplicate.description).toBe('Preserve this')
  })

  test('should timestamp a restored collection version as a new row (#17760)', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: postsSlug,
      overrideAccess: true,
      data: { title: 'Original', createdAt: '2000-01-01T00:00:00.000Z', _status: 'published' },
    })
    const versions = await payload.findVersions({
      collection: postsSlug,
      overrideAccess: true,
      where: { parent: { equals: doc.id } },
      sort: 'createdAt',
    })
    await payload.update({
      collection: postsSlug,
      id: doc.id,
      overrideAccess: true,
      data: { title: 'Changed' },
    })
    const restored = await payload.restoreVersion({
      collection: postsSlug,
      id: versions.docs[0]!.id,
      overrideAccess: true,
    })
    const latest = await payload.findVersions({
      collection: postsSlug,
      overrideAccess: true,
      where: { and: [{ parent: { equals: doc.id } }, { latest: { equals: true } }] },
    })
    const row = latest.docs[0]!

    expect(restored.title).toBe('Original')
    expect(row.createdAt).toBe(row.updatedAt)
    expect(row.version.createdAt).toBe(doc.createdAt)
    expect(restored.createdAt).toBe(doc.createdAt)
  })

  test('should timestamp a restored global version as a new row (#17760)', async ({ payload }) => {
    const doc = await payload.updateGlobal({
      slug: settingsSlug,
      overrideAccess: true,
      data: { title: 'Original', createdAt: '2000-01-01T00:00:00.000Z', _status: 'published' },
    })
    const versions = await payload.findGlobalVersions({
      slug: settingsSlug,
      overrideAccess: true,
      where: { 'version.title': { equals: 'Original' } },
    })
    await payload.updateGlobal({
      slug: settingsSlug,
      overrideAccess: true,
      data: { title: 'Changed' },
    })
    const restored = await payload.restoreGlobalVersion({
      slug: settingsSlug,
      id: versions.docs[0]!.id,
      overrideAccess: true,
    })
    const latest = await payload.findGlobalVersions({
      slug: settingsSlug,
      overrideAccess: true,
      where: { latest: { equals: true } },
    })
    const row = latest.docs[0]!

    expect(restored.title).toBe('Original')
    expect(row.createdAt).toBe(row.updatedAt)
    expect(row.version.createdAt).toBe(doc.createdAt)
    expect(restored.createdAt).toBe(doc.createdAt)
  })

  test.options(
    'should avoid fetching version bodies for a parent-only SQL projection (#18251)',
    { db: 'drizzle' },
    async ({ payload }) => {
      const doc = await payload.create({
        collection: postsSlug,
        overrideAccess: true,
        data: {
          title: 'Original',
          _status: 'published',
          items: [{ label: 'Array' }],
          content: [{ blockType: 'text', body: 'Block' }],
        },
      })
      const adapter = payload.db as unknown as DrizzleAdapter
      const tableName = adapter.tableNameMap.get(
        `_${postsSlug.replaceAll('-', '_')}${adapter.versionsSuffix}`,
      )!
      const database = await getTransaction(adapter)
      const queries = database.query as unknown as Record<
        string,
        {
          findMany: (args: {
            columns?: Record<string, boolean>
            with?: Record<string, unknown>
          }) => unknown
        }
      >
      const findMany = vi.spyOn(queries[tableName]!, 'findMany')

      try {
        const versions = await payload.findVersions({
          collection: postsSlug,
          overrideAccess: true,
          select: { parent: true },
          depth: 0,
          where: { parent: { equals: doc.id } },
        })
        expect(versions.docs).toHaveLength(1)
        expect(versions.docs[0]!.parent).toBe(doc.id)
        expect(findMany).toHaveBeenCalled()
        const args = findMany.mock.calls[0]![0]!
        expect(Object.keys(args.with ?? {})).not.toContain('version_items')
        expect(Object.keys(args.with ?? {})).not.toContain('version_content')
        expect(args.columns).not.toHaveProperty('version_title')
      } finally {
        findMany.mockRestore()
      }
    },
  )

  test('should preserve parent locale through nested validation reads and persist both locales (#18844)', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: labelsSlug,
      data: { label: 'English' },
      locale: 'en',
    })
    await payload.update({
      collection: labelsSlug,
      id: doc.id,
      data: { label: 'Français' },
      locale: 'fr',
    })
    const result = await payload.findByID({ collection: labelsSlug, id: doc.id, locale: 'all' })

    expect(result.label).toEqual({ en: 'English', fr: 'Français' })
  })
})
