import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { expect, it, vi } from 'vitest'

import { execute } from '../../../drizzle/src/postgres/execute.js'
import { migrateLocalizeStatus } from './migrateLocalizeStatus.js'

it.each(['database', 'transaction', 'adapter'])(
  'should execute the localize-status migration with a %s (#19404)',
  async (connectionType) => {
    const query = vi.fn(async (statement: { text: string }, params: unknown[]) => {
      const text = statement.text
      let rows: Record<string, unknown>[] = []
      if (text.includes('information_schema.columns')) {
        rows = [
          {
            exists:
              text.includes("'version__status'") ||
              text.includes("'snapshot'") ||
              params.includes('snapshot'),
          },
        ]
      } else if (text.includes('information_schema.tables')) {
        rows = [{ exists: !params.some((value) => String(value).startsWith('_')) }]
      } else if (text.includes('SELECT DISTINCT id') || text.includes('SELECT id FROM')) {
        rows = [{ id: 7 }]
      } else if (text.includes('SELECT l.version__status')) {
        rows = [{ _status: 'published' }]
      }
      return { rows, rowCount: rows.length }
    })
    const database = drizzle({ client: { query } as never })
    const unusedConnectionQuery = vi.fn(() => {
      throw new Error('Migration escaped its database')
    })
    const payload = {
      db: {
        execute,
        drizzle: drizzle({ client: { query: unusedConnectionQuery } as never }),
        schemaName: 'cms',
      },
      config: {
        localization: { localeCodes: ['en', 'fr'] },
        collections: [{ slug: 'posts', versions: { drafts: { localizeStatus: true } } }],
        globals: [{ slug: 'settings', versions: { drafts: { localizeStatus: true } } }],
      },
      logger: { info: vi.fn(), warn: vi.fn() },
    }
    const migrate = (db: unknown) => migrateLocalizeStatus({ db, payload, req: {}, sql } as never)
    if (connectionType === 'transaction') {
      await database.transaction(migrate)
    } else if (connectionType === 'adapter') {
      await migrate({ ...payload.db, drizzle: database })
    } else {
      await migrate(database)
    }
    const statements = query.mock.calls.map(([statement]) => statement.text)
    expect(statements.some((text) => text.includes('UPDATE "posts_locales"'))).toBe(true)
    expect(statements.some((text) => text.includes('UPDATE "settings_locales"'))).toBe(true)
    expect(statements.filter((text) => text.includes('DROP COLUMN snapshot'))).toHaveLength(2)
    expect(query.mock.calls.some(([, params]) => params?.includes('cms'))).toBe(true)
    expect(unusedConnectionQuery).not.toHaveBeenCalled()
    if (connectionType === 'transaction') {
      expect(statements[0]).toBe('begin')
      expect(statements.at(-1)).toBe('commit')
    }
  },
)
