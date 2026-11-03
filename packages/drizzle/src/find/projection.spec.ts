import type { FlattenedField } from 'payload'

import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { buildFindManyArgs } from './buildFindManyArgs.js'

const fields = [
  { name: 'parent', type: 'text' },
  {
    name: 'version',
    type: 'group',
    flattenedFields: [
      { name: 'title', type: 'text' },
      { name: 'items', type: 'array', flattenedFields: [{ name: 'label', type: 'text' }] },
    ],
  },
] as FlattenedField[]
const adapter = {
  tableNameMap: new Map([['versions_version_items', 'items']]),
  tables: { versions: { parent: {}, version_title: {} }, items: { label: {} } },
  localesSuffix: '_locales',
  relationshipsSuffix: '_rels',
} as unknown as DrizzleAdapter
const build = (select?: Record<string, unknown>) =>
  buildFindManyArgs({ adapter, depth: 0, fields, select, tableName: 'versions' })

describe('nested SQL projection fidelity (#18251)', () => {
  it('should omit unselected version scalar and array columns', () => {
    const result = build({ parent: true })

    expect(result.columns).toEqual({ id: true, parent: true })
    expect(Object.keys(result.with ?? {})).toEqual([])
  })

  it('should preserve explicitly selected nested fields and whole-group selections', () => {
    expect(build({ version: { title: true } }).columns).toMatchObject({ version_title: true })
    expect(build({ version: true }).with).toHaveProperty('version_items')
    expect(build().with).toHaveProperty('version_items')
  })
})
