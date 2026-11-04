import { randomUUID } from 'node:crypto'
import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { createExport } from '../../packages/plugin-import-export/src/export/createExport.js'
import { handlePreview } from '../../packages/plugin-import-export/src/export/handlePreview.js'
import { test } from '../__helpers/int/vitest.js'
import { readCSV } from '../plugin-import-export/helpers.js'
import { postsSlug, restrictedSlug, settingsSlug } from './slugs.js'

test.suite('Server regressions batch 6', { config: './config.ts' }, () => {
  test('should propagate explicit overrideAccess through global filter validation (#18674)', async ({
    payload,
  }) => {
    const related = await payload.create({
      collection: restrictedSlug,
      overrideAccess: true,
      data: { allowed: true },
    })
    const result = await payload.updateGlobal({
      slug: settingsSlug,
      overrideAccess: true,
      data: { link: related.id },
      depth: 0,
    })

    expect(result.link).toBe(related.id)
    const persisted = await payload.findGlobal({
      slug: settingsSlug,
      overrideAccess: true,
      depth: 0,
    })
    expect(persisted.link).toBe(related.id)
    await expect(
      payload.updateGlobal({
        slug: settingsSlug,
        overrideAccess: false,
        data: { link: related.id },
      }),
    ).rejects.toThrow()
    const filtered = await payload.create({
      collection: restrictedSlug,
      overrideAccess: true,
      data: { allowed: false },
    })
    await expect(
      payload.updateGlobal({
        slug: settingsSlug,
        overrideAccess: true,
        data: { link: filtered.id },
      }),
    ).rejects.toThrow()
  })
  test('should use the matching locale in persisted duplicate field values (#17021)', async ({
    payload,
  }) => {
    const post = await payload.create({
      collection: postsSlug,
      overrideAccess: true,
      locale: 'en',
      data: { title: 'Hello' },
    })
    await payload.update({
      collection: postsSlug,
      id: post.id,
      overrideAccess: true,
      locale: 'fr',
      data: { title: 'Bonjour' },
    })
    const duplicate = await payload.duplicate({
      collection: postsSlug,
      id: post.id,
      overrideAccess: true,
      locale: 'en',
    })
    const localized = await payload.findByID({
      collection: postsSlug,
      id: duplicate.id,
      overrideAccess: true,
      locale: 'all',
    })

    expect(localized.title).toEqual({ en: 'Hello-en', fr: 'Bonjour-fr' })
  })
  test('should execute Access and docAccess GraphQL queries on real permission results (#19168)', async ({
    payload,
    restClient,
  }) => {
    const password = randomUUID()

    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: 'batch6@example.test', password },
    })
    await restClient.login({
      slug: 'users',
      credentials: { email: 'batch6@example.test', password },
    })
    const post = await payload.create({ collection: postsSlug, data: { title: 'GraphQL' } })
    const response = await restClient.GRAPHQL_POST({
      body: JSON.stringify({
        query: `query($id: ${typeof post.id === 'number' ? 'Int' : 'String'}!) {
        Access { canAccessAdmin batch6_posts { read { permission } delete { permission } fields { title { read { permission } } } } }
        docAccessBatchSixPost(id: $id) { update { permission } delete { permission } }
      }`,
        variables: { id: post.id },
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.errors).toBeUndefined()
    expect(result.data).toMatchObject({
      Access: {
        canAccessAdmin: true,
        batch6_posts: {
          read: { permission: true },
          delete: { permission: false },
          fields: { title: { read: { permission: true } } },
        },
      },
      docAccessBatchSixPost: { update: { permission: true }, delete: { permission: false } },
    })
    const anonymous = await (
      await restClient.GRAPHQL_POST({
        auth: false,
        body: JSON.stringify({ query: '{ Access { canAccessAdmin } }' }),
      })
    ).json()

    expect(anonymous.errors).toBeUndefined()
    expect(anonymous.data?.Access).toEqual({ canAccessAdmin: false })
  })

  for (const download of [false, true]) {
    test(`should omit array placeholder columns after scalar hooks with download=${download} (#19141)`, async ({
      payload,
    }) => {
      const user = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: { email: 'csv@example.test', password: randomUUID() },
      })
      const post = await payload.create({
        collection: postsSlug,
        data: {
          title: 'CSV',
          _status: 'published',
          items: [{ label: 'Item' }],
          tags: [{ label: 'x' }, { label: 'y' }],
        },
      })
      const req = await createPayloadRequest({ payload, user, locale: 'en' })
      const result = await createExport({
        download,
        id: '',
        name: 'batch6-regression',
        exportCollection: postsSlug,
        collectionSlug: postsSlug,
        format: 'csv',
        exportDoc: {},
        req,
      })
      const contents =
        result instanceof Response ? Buffer.from(await result.text()) : req.file!.data
      const rows = await readCSV(contents)

      expect(rows).toHaveLength(1)
      expect(rows[0].tags).toBe('x | y')
      expect(rows[0].items_0_label).toBe('Item')
      expect(Object.keys(rows[0])).not.toContain('tags_0_label')
      expect(Object.keys(rows[0])).not.toContain('tags_0_id')
      const previewReq = await createPayloadRequest({
        payload,
        user,
        locale: 'en',
        req: { data: { collectionSlug: postsSlug, format: 'csv', locale: 'en' } },
      })
      const preview = await (await handlePreview(previewReq)).json()

      expect(preview.docs[0].tags).toBe('x | y')
      expect(preview.columns).not.toContain('tags_0_label')
      await payload.update({
        collection: postsSlug,
        id: post.id,
        data: { keepArray: true, _status: 'published' },
      })
      const fallbackReq = await createPayloadRequest({
        payload,
        user,
        context: { keepArray: true },
        locale: 'en',
      })
      const fallback = await createExport({
        download,
        id: '',
        name: 'batch6-regression',
        exportCollection: postsSlug,
        collectionSlug: postsSlug,
        format: 'csv',
        exportDoc: {},
        req: fallbackReq,
      })
      const fallbackRows = await readCSV(
        fallback instanceof Response ? Buffer.from(await fallback.text()) : fallbackReq.file!.data,
      )
      expect(fallbackRows[0].tags_0_label).toBe('x')
      expect(fallbackRows[0].tags_1_label).toBe('y')
    })
  }
})
