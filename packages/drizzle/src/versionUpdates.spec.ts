import type { DrizzleAdapter } from './types.js'

import { createClient } from '@libsql/client'
import { SQLiteSyncDialect, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./upsertRow/index.js', () => ({
  upsertRow: vi.fn(async () => ({ id: 5, updatedAt: '2026-11-04' })),
}))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  buildVersionCollectionFields: () => [],
  buildVersionGlobalFields: () => [],
}))
import { createGlobalVersion } from './createGlobalVersion.js'
import { createVersion } from './createVersion.js'

const table = sqliteTable('versions', {
  id: integer('id'),
  parent: integer('parent_id'),
  updatedAt: text('updated_at'),
  latest: integer('latest', { mode: 'boolean' }),
})

describe('version latest write amplification (#18465)', () => {
  it.each(['collection', 'global'])(
    'should skip already-false %s versions while clearing true and legacy null flags',
    async (kind) => {
      const client = createClient({ url: ':memory:' })
      try {
        await client.executeMultiple(`CREATE TABLE versions (id INTEGER, parent_id INTEGER, updated_at TEXT, latest INTEGER);
        INSERT INTO versions VALUES (1,1,'2026-01-01',0),(2,1,'2026-01-02',1),(3,1,'2026-01-03',NULL),(4,2,'2026-01-04',1),(5,1,'2026-11-04',1);
        CREATE TABLE writes (id INTEGER);
        CREATE TRIGGER count_writes AFTER UPDATE ON versions BEGIN INSERT INTO writes VALUES (NEW.id); END;`)
        const config = { slug: 'posts', versions: { drafts: true } }
        const adapter = {
          tables: { versions: table },
          tableNameMap: new Map([['_posts_v', 'versions']]),
          versionsSuffix: '_v',
          drizzle: {},
          sessions: {},
          payload: {
            config: {},
            collections: { posts: { config } },
            globals: { config: [config] },
          },
          execute: async ({ sql }) => {
            const query = new SQLiteSyncDialect().sqlToQuery(sql)
            return client.execute({ sql: query.sql, args: query.params })
          },
        } as unknown as DrizzleAdapter
        const args = {
          createdAt: '2026-11-04',
          updatedAt: '2026-11-04',
          parent: 1,
          versionData: {},
          collectionSlug: 'posts',
          globalSlug: 'posts',
        }
        await (kind === 'collection' ? createVersion : createGlobalVersion).call(
          adapter,
          args as never,
        )
        expect(
          (await client.execute('SELECT id FROM writes ORDER BY id')).rows.map((row) => row.id),
        ).toEqual(kind === 'collection' ? [2, 3] : [2, 3, 4])
        expect(
          (await client.execute('SELECT latest FROM versions WHERE id=5')).rows[0].latest,
        ).toBe(1)
      } finally {
        client.close()
      }
    },
  )
})
