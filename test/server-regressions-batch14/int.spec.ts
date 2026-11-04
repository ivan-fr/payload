import type { Batch14Article } from './payload-types.js'

import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { createImport } from '../../packages/plugin-import-export/src/import/createImport.js'
import { test } from '../__helpers/int/vitest.js'
import { articlesSlug, categoriesSlug, postsSlug, usersSlug } from './slugs.js'

test.suite('Server regressions batch 14', { config: './config.ts' }, () => {
  test('should update underscored fields through the CSV import pipeline (#17118)', async ({
    payload,
  }) => {
    const post = await payload.create({
      collection: postsSlug,
      overrideAccess: true,
      data: {
        title: 'Import',
        vat_number: 'old',
        group_meta: { tax_code: 'old' },
        _status: 'published',
      },
    })
    const user = await payload.create({
      collection: usersSlug,
      overrideAccess: true,
      data: { email: 'importer@example.com', password: 'test' },
    })
    const req = await createPayloadRequest({ payload })
    const result = await createImport({
      collectionSlug: postsSlug,
      userCollection: usersSlug,
      userID: user.id,
      req,
      importDoc: {},
      format: 'csv',
      importMode: 'update',
      name: 'update.csv',
      file: {
        name: 'update.csv',
        mimetype: 'text/csv',
        data: Buffer.from(`id,vat_number,group_meta_tax_code\n${post.id},FR123,FR456\n`),
      },
    })
    expect(result.errors).toEqual([])
    expect(result.updated).toBe(1)
    const updated = await payload.findByID({
      collection: postsSlug,
      id: post.id,
      overrideAccess: true,
    })
    expect(updated.vat_number).toBe('FR123')
    expect(updated.group_meta?.tax_code).toBe('FR456')
  })

  test('should reject multiple empty required rich-text paragraphs and save real content (#19222)', async ({
    payload,
  }) => {
    const body: Batch14Article['body'] = {
      root: {
        type: 'root',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        children: [
          {
            type: 'paragraph',
            version: 1,
            direction: null,
            format: '',
            indent: 0,
            textFormat: 0,
            textStyle: '',
            children: [],
          },
          {
            type: 'paragraph',
            version: 1,
            direction: null,
            format: '',
            indent: 0,
            textFormat: 0,
            textStyle: '',
            children: [],
          },
        ],
      },
    }
    await expect(
      payload.create({ collection: articlesSlug, overrideAccess: true, data: { body } }),
    ).rejects.toMatchObject({
      status: 400,
      data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'body' })]) },
    })
    const count = await payload.count({ collection: articlesSlug, overrideAccess: true })
    expect(count.totalDocs).toBe(0)
    const content = structuredClone(body)
    content.root.children[1] = {
      type: 'paragraph',
      textFormat: 0,
      textStyle: '',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [
        {
          type: 'text',
          version: 1,
          text: 'Meaningful',
          format: 0,
          detail: 0,
          mode: 'normal',
          style: '',
        },
      ],
    }
    const article = await payload.create({
      collection: articlesSlug,
      overrideAccess: true,
      data: { body: content },
    })
    expect(article.body).toEqual(content)
  })

  test.options(
    'should count to-one filters and avoid duplicated totals for to-many joins (#19139)',
    { db: 'drizzle' },
    async ({ payload }) => {
      const first = await payload.create({
        collection: categoriesSlug,
        overrideAccess: true,
        data: { label: 'Match' },
      })
      const second = await payload.create({
        collection: categoriesSlug,
        overrideAccess: true,
        data: { label: 'Match' },
      })
      for (let index = 0; index < 3; index++)
        await payload.create({
          collection: postsSlug,
          overrideAccess: true,
          data: {
            title: `Post ${index}`,
            owner: index === 2 ? null : first.id,
            many: index === 0 ? [first.id, second.id] : [],
            _status: 'published',
          },
        })
      const single = await payload.find({
        collection: postsSlug,
        overrideAccess: true,
        limit: 1,
        where: { 'owner.label': { equals: 'Match' } },
      })
      expect(single.docs).toHaveLength(1)
      expect(single.totalDocs).toBe(2)
      const many = await payload.find({
        collection: postsSlug,
        overrideAccess: true,
        limit: 1,
        where: { 'many.label': { equals: 'Match' } },
      })
      expect(many.docs).toHaveLength(1)
      expect(many.totalDocs).toBe(1)
    },
  )
})
