import { alias, jsonb, pgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { createJSONQuery } from './index.js'

describe('Postgres JSON filters (#19063)', () => {
  const posts = pgTable('posts', { data: jsonb() })

  it('should qualify the JSON column with its table and respect aliases', () => {
    for (const table of [posts, alias(posts, 'joined_posts')]) {
      const query = createJSONQuery({
        column: table.data,
        operator: 'exists',
        pathSegments: ['data', 'publishedAt'],
        value: true,
      })

      expect(query).toContain(table === posts ? '"posts"."data"' : '"joined_posts"."data"')
    }
  })

  it.each([
    ['less_than', '<'],
    ['less_than_equal', '<='],
    ['greater_than', '>'],
    ['greater_than_equal', '>='],
  ])('should support %s on JSON values', (operator, symbol) => {
    for (const value of [42, '2026-10-26T00:00:00.000Z']) {
      expect(
        createJSONQuery({ column: posts.data, operator, pathSegments: ['data', 'value'], value }),
      ).toContain(`@ ${symbol} ${typeof value === 'number' ? value : `"${value}"`}`)
    }
  })

  it('should reject unsupported JSON operators with a client error', () => {
    expect(() =>
      createJSONQuery({
        column: posts.data,
        operator: 'near',
        pathSegments: ['data', 'x'],
        value: 1,
      }),
    ).toThrow(expect.objectContaining({ status: 400 }))
  })
})
