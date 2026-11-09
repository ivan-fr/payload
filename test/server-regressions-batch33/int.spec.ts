import type { SQLiteAdapter } from '@payloadcms/db-sqlite'

import { readFile, rm } from 'node:fs/promises'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { mediaSlug, peopleSlug, reportsSlug } from './slugs.js'

test.suite(
  'relationship migration and standalone uploads (#16955, #18588)',
  { config: './config.ts' },
  () => {
    test.options(
      'should preserve relationships and their order in current documents and versions',
      { db: 'drizzle' },
      async ({ payload }) => {
        const people = await Promise.all(
          ['First', 'Second'].map((name) =>
            payload.create({ collection: peopleSlug, data: { name }, overrideAccess: true }),
          ),
        )
        const ids = people.map(({ id }) => id)
        const report = await payload.create({
          collection: reportsSlug,
          data: { owners: ids, reviewers: [ids[1]] },
          overrideAccess: true,
        })
        const versions = await payload.findVersions({
          collection: reportsSlug,
          where: { parent: { equals: report.id } },
          depth: 0,
          overrideAccess: true,
        })
        const versionID = versions.docs[0]!.id
        const docs = await readFile(
          new URL('../../docs/database/migrations.mdx', import.meta.url),
          'utf8',
        )
        const section = docs.slice(docs.indexOf('## Renaming relationship fields'))
        const snippets = [...section.matchAll(/```sql\n([\s\S]*?)```/g)].map((match) => match[1]!)
        expect(snippets).toHaveLength(2)
        const db = payload.db as SQLiteAdapter
        const read = async () => ({
          document: await payload.findByID({
            collection: reportsSlug,
            id: report.id,
            depth: 0,
            overrideAccess: true,
          }),
          version: (
            await payload.findVersionByID({
              collection: reportsSlug,
              id: versionID,
              depth: 0,
              overrideAccess: true,
            })
          ).version,
        })
        for (const [index, snippet] of snippets.entries()) {
          for (const statement of snippet.split(';').filter((value) => value.trim())) {
            await db.execute({ drizzle: db.drizzle, raw: statement })
          }
          const result = await read()
          for (const value of [result.document, result.version]) {
            expect(value[index === 0 ? 'owners2' : 'owners']).toEqual(ids)
            expect(value.reviewers).toEqual([ids[1]])
            expect(value[index === 0 ? 'owners' : 'owners2'] ?? []).toEqual([])
          }
        }
      },
    )
    test('should serve uploads and byte ranges through the statically imported tokenizer (#18588)', async ({
      payload,
      restClient,
    }) => {
      const data = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c2Z8AAAAASUVORK5CYII=',
        'base64',
      )
      const config = payload.collections[mediaSlug].config
      const directory = config.upload && config.upload.staticDir
      let id: number | string | undefined
      try {
        const media = await payload.create({
          collection: mediaSlug,
          data: {},
          file: { data, mimetype: 'image/png', name: 'tiny.png', size: data.length },
          overrideAccess: true,
        })
        id = media.id
        const response = await restClient.GET(`/${mediaSlug}/file/${media.filename}`)
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('image/png')
        expect(Buffer.from(await response.arrayBuffer())).toEqual(data)
        const range = await restClient.GET(`/${mediaSlug}/file/${media.filename}`, {
          headers: { Range: 'bytes=0-7' },
        })
        expect(range.status).toBe(206)
        expect(Buffer.from(await range.arrayBuffer())).toEqual(data.subarray(0, 8))
      } finally {
        try {
          if (id !== undefined)
            await payload.delete({ collection: mediaSlug, id, overrideAccess: true })
        } finally {
          if (directory) await rm(directory, { recursive: true, force: true })
        }
      }
    })
  },
)
