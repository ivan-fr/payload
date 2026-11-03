import { jsonb, pgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { createJSONQuery } from '../postgres/createJSONQuery/index.js'
import { escapeSQLValue } from './escapeSQLValue.js'

describe('JSON query string validation (#16401)', () => {
  it.each([
    '你好世界',
    'café',
    'cafe\u0301',
    'مرحبا ١٢',
    '\u{1F600}',
    '\u{1F469}\u200D\u{1F4BB}',
    '\u{1F1EB}\u{1F1F7}',
    'a_B 2@example.com-+:',
  ])('should accept Unicode text %s', (value) => {
    expect(escapeSQLValue(value)).toBe(value)
  })

  it.each(["' OR 1=1 --", 'a"b', 'a\\b', 'a;b', 'a\nb', 'a\u0000b', 'a/b', '$.secret'])(
    'should reject unsafe query syntax %s',
    (value) => {
      expect(() => escapeSQLValue(value)).toThrow('is not allowed as a JSON query value')
    },
  )

  it.each([null, true, false, 0, 123])('should preserve primitive %s', (value) => {
    expect(escapeSQLValue(value)).toBe(value)
  })

  it('should reject unsupported value types', () => {
    expect(() => escapeSQLValue({ text: 'hello' })).toThrow('Invalid value type')
  })
})

describe('PostgreSQL Unicode JSON queries (#16401)', () => {
  it('should generate a Unicode JSONpath expression and reject SQL delimiters', () => {
    const table = pgTable('posts', { meta: jsonb() })
    const query = createJSONQuery({
      column: table.meta,
      operator: 'equals',
      pathSegments: ['title'],
      value: '你好世界',
    })
    expect(query).toContain('你好世界')
    expect(() =>
      createJSONQuery({
        column: table.meta,
        operator: 'equals',
        pathSegments: ['title'],
        value: "' OR 1=1 --",
      }),
    ).toThrow('is not allowed as a JSON query value')
  })
})
