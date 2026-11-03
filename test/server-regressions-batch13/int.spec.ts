import type { SQLiteAdapter } from '@payloadcms/db-sqlite'

import { rm } from 'node:fs/promises'
import { createPayloadRequest, handleEndpoints } from 'payload'
import { expect, vi } from 'vitest'

import { lockedDocumentsCollectionSlug } from '../../packages/payload/src/locked-documents/config.js'
import {
  deleteDocumentLocks,
  getLockedDocumentIds,
} from '../../packages/payload/src/utilities/checkDocumentLockStatus.js'
import { test } from '../__helpers/int/vitest.js'
import { uploadDir } from './collections/index.js'
import { cloudSlug, mediaSlug, otherSlug, postsSlug, usersSlug } from './slugs.js'

test.suite('Server regressions batch 13', { config: './config.ts' }, () => {
  test.afterEach(async () => {
    vi.restoreAllMocks()
    await rm(uploadDir, { recursive: true, force: true })
  })

  test.options(
    'should query Unicode JSON values without accepting SQL syntax (#16401)',
    { db: 'drizzle' },
    async ({ payload }) => {
      const post = await payload.create({
        collection: postsSlug,
        overrideAccess: true,
        data: { title: 'Unicode', meta: { title: '你好世界' } },
      })
      for (const condition of [
        { equals: '你好世界' },
        { like: '你好' },
        { in: ['你好世界', 'café'] },
      ]) {
        const result = await payload.find({
          collection: postsSlug,
          overrideAccess: true,
          where: { 'meta.title': condition },
        })
        expect(result.docs.map((doc) => doc.id)).toEqual([post.id])
      }
      await expect(
        payload.find({
          collection: postsSlug,
          overrideAccess: true,
          where: { 'meta.title': { equals: "' OR 1=1 --" } },
        }),
      ).rejects.toThrow()
    },
  )

  test.options(
    'should preserve point coordinates in full and selected update responses (#17461)',
    { db: 'drizzle' },
    async ({ payload }) => {
      const post = await payload.create({
        collection: postsSlug,
        overrideAccess: true,
        data: { title: 'Place', location: [10, 20], _status: 'published' },
      })
      const full = await payload.update({
        collection: postsSlug,
        id: post.id,
        overrideAccess: true,
        data: { title: 'Renamed' },
      })
      expect(full.location).toEqual([10, 20])
      const selected = await payload.update({
        collection: postsSlug,
        id: post.id,
        overrideAccess: true,
        data: { title: 'Selected' },
        select: { location: true },
      })
      expect(selected.location).toEqual([10, 20])
      expect(selected).not.toHaveProperty('title')
      expect(
        (await payload.findByID({ collection: postsSlug, id: post.id, overrideAccess: true }))
          .location,
      ).toEqual([10, 20])
    },
  )

  test('should retain omitted nested access-denied fields through a partial update and publication (#18415)', async ({
    payload,
  }) => {
    const original = await payload.create({
      collection: postsSlug,
      overrideAccess: true,
      data: {
        title: 'Original',
        _status: 'published',
        items: [{ label: 'Outer', children: [{ label: 'Inner', code: 'PRESERVED' }] }],
      },
    })
    const req = await createPayloadRequest({ payload })
    const storedUser = await payload.create({
      collection: usersSlug,
      overrideAccess: true,
      data: { email: 'editor@example.com', password: 'test' },
    })
    const editor = { ...storedUser, collection: usersSlug, role: 'editor' } as never
    req.user = editor
    const updated = await payload.update({
      collection: postsSlug,
      id: original.id,
      overrideAccess: false,
      user: editor,
      req,
      draft: true,
      data: { title: 'Draft' },
    })
    expect(updated.items).toEqual(original.items)
    const published = await payload.update({
      collection: postsSlug,
      id: original.id,
      overrideAccess: false,
      user: editor,
      req,
      draft: false,
      data: { _status: 'published' },
    })
    expect(published.items).toEqual(original.items)
    const persisted = await payload.findByID({
      collection: postsSlug,
      id: original.id,
      overrideAccess: true,
      draft: false,
    })
    expect(persisted.items).toEqual(original.items)
  })

  test('should serve cloud bytes allowed by static access while denying document reads (#19008)', async ({
    payload,
    restClient,
  }) => {
    const doc = await payload.create({
      collection: cloudSlug,
      overrideAccess: true,
      data: { filename: 'private-metadata.txt', mimeType: 'text/plain', prefix: 'allowed' },
    })
    const denied = await restClient.GET(`/${cloudSlug}/${doc.id}`)
    expect(denied.status).toBe(403)
    const response = await restClient.GET(`/${cloudSlug}/file/private-metadata.txt`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('object:allowed/private-metadata.txt')
  })

  test('should return file GET headers without a HEAD response body (#16754)', async ({
    payload,
  }) => {
    const bytes = Buffer.from('File metadata test')
    const doc = await payload.create({
      collection: mediaSlug,
      overrideAccess: true,
      data: {},
      file: { data: bytes, name: 'metadata.txt', mimetype: 'text/plain', size: bytes.length },
    })
    const url = `http://localhost:3000/api/${mediaSlug}/file/${doc.filename}`
    const get = await handleEndpoints({ config: payload.config, request: new Request(url) })
    const head = await handleEndpoints({
      config: payload.config,
      request: new Request(url, { method: 'HEAD' }),
    })
    expect(head.status).toBe(200)
    for (const header of [
      'content-type',
      'content-length',
      'content-security-policy',
      'x-content-type-options',
    ])
      expect(head.headers.get(header)).toBe(get.headers.get(header))
    expect(await head.text()).toBe('')
    expect(await get.text()).toBe(bytes.toString())
    const denied = await handleEndpoints({
      config: payload.config,
      request: new Request(url, { method: 'HEAD', headers: { 'x-deny-file': 'true' } }),
    })
    expect(denied.status).toBe(403)
    expect(await denied.text()).toBe('')
  })

  test('should prioritize explicit HEAD routes and strip bodies from fallback and error responses (#16754)', async ({
    payload,
  }) => {
    const request = async ({ path, method = 'HEAD' }: { path: string; method?: string }) =>
      handleEndpoints({
        config: payload.config,
        request: new Request(`http://localhost:3000/api/${path}`, { method }),
      })
    const explicit = await request({ path: 'batch13-explicit' })
    expect(explicit.headers.get('x-handler')).toBe('head')
    expect(await explicit.text()).toBe('')
    const get = await request({ path: 'batch13-explicit', method: 'GET' })
    expect(await get.text()).toBe('GET')
    const fallback = await request({ path: 'batch13-fallback' })
    expect(fallback.headers.get('x-handler')?.toUpperCase()).toBe('HEAD')
    expect(await fallback.text()).toBe('')
    for (const path of ['batch13-missing', 'batch13-post', 'batch13-error']) {
      const response = await request({ path })
      expect(response.status).toBe(path === 'batch13-error' ? 500 : 404)
      expect(await response.text()).toBe('')
    }
  })

  test.options(
    'should bound lock query parameters and scope cleanup to one collection (#19233)',
    { db: (adapterType) => adapterType === 'sqlite' },
    async ({ payload }) => {
      const post = await payload.create({
        collection: postsSlug,
        overrideAccess: true,
        data: { title: 'Locked', _status: 'published' },
      })
      const other = await payload.create({
        collection: otherSlug,
        overrideAccess: true,
        data: { title: 'Other' },
      })
      const user = await payload.create({
        collection: usersSlug,
        overrideAccess: true,
        data: { email: 'lock-owner@example.com', password: 'test' },
      })
      for (const document of [
        { relationTo: postsSlug, value: post.id } as const,
        { relationTo: otherSlug, value: other.id } as const,
      ]) {
        await payload.create({
          collection: lockedDocumentsCollectionSlug,
          overrideAccess: true,
          data: { document, user: { relationTo: usersSlug, value: user.id } },
        })
      }
      const adapter = payload.db as unknown as SQLiteAdapter
      const originalLimit = adapter.limitedBoundParameters
      const statements: { sql: string; args?: unknown }[] = []
      const execute = adapter.client.execute.bind(adapter.client)
      vi.spyOn(adapter.client, 'execute').mockImplementation(async (...args) => {
        const statement = args[0]
        if (
          typeof statement === 'object' &&
          'sql' in statement &&
          statement.sql.includes('payload_locked_documents')
        ) {
          statements.push(statement)
          expect(
            Array.isArray(statement.args)
              ? statement.args.length
              : Object.keys(statement.args ?? {}).length,
          ).toBeLessThanOrEqual(100)
        }
        return execute(...args)
      })
      adapter.limitedBoundParameters = true
      const req = await createPayloadRequest({ payload })
      const ids = [post.id, other.id, ...Array.from({ length: 130 }, (_, index) => 10000 + index)]
      try {
        const locked = await getLockedDocumentIds({
          collectionSlug: postsSlug,
          ids,
          overrideLock: false,
          req,
        })
        expect(locked).toEqual(new Set([String(post.id)]))
        await deleteDocumentLocks({ collectionSlug: postsSlug, ids, req })
        expect(statements.length).toBeGreaterThan(2)
        const remaining = await payload.find({
          collection: lockedDocumentsCollectionSlug,
          overrideAccess: true,
          depth: 0,
        })
        expect(remaining.docs).toHaveLength(1)
        expect(remaining.docs[0]!.document).toEqual({ relationTo: otherSlug, value: other.id })
      } finally {
        adapter.limitedBoundParameters = originalLimit
      }
    },
  )
})
