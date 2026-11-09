import { sql } from 'drizzle-orm'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { expect, it } from 'vitest'

import { buildLimitedIDList } from './buildLimitedIDList.js'

it.each(["x'); DROP TABLE posts; --", Infinity, NaN, {}, true])(
  'should reject unsafe inline identifiers: %s',
  (value) => {
    expect(() =>
      buildLimitedIDList({ column: sql`parent_id`, operator: 'in', values: [value] }),
    ).toThrow('Invalid ID value')
  },
)
it('should inline validated custom text and UUID IDs without consuming parameters', () => {
  const result = new SQLiteSyncDialect().sqlToQuery(
    buildLimitedIDList({
      column: sql`parent_id`,
      operator: 'in',
      values: ['custom-id', '878aeef4-b31c-4512-863d-43912f7cf81c'],
    }),
  )
  expect(result.params).toEqual([])
  expect(result.sql).toContain("'custom-id'")
})
