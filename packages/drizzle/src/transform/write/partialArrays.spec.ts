import type { FlattenedField } from 'payload'

import { describe, expect, it } from 'vitest'

import type { DrizzleAdapter } from '../../types.js'

import { transformForWrite } from './index.js'

const fields = ['sessions', 'tenants'].map((name) => ({
  name,
  type: 'array',
  flattenedFields: [],
})) as FlattenedField[]

const adapter = {
  tableNameMap: new Map([
    ['users_sessions', 'users_sessions'],
    ['users_tenants', 'users_tenants'],
  ]),
  tables: { users_sessions: {}, users_tenants: {} },
} as unknown as DrizzleAdapter

describe('partial array updates', () => {
  it.each([{}, { tenants: undefined }])(
    'should preserve omitted arrays when persisting sessions: %j',
    (data) => {
      const result = transformForWrite({
        adapter,
        data: { ...data, sessions: [] },
        fields,
        tableName: 'users',
      })

      expect(result.arrays).toEqual({ users_sessions: [] })
    },
  )

  it.each([{ tenants: [] }, { tenants: null }])(
    'should still clear an explicitly empty array: %j',
    (data) => {
      const result = transformForWrite({
        adapter,
        data,
        fields,
        tableName: 'users',
      })

      expect(result.arrays).toEqual({ users_tenants: [] })
    },
  )
})
