import type { SanitizedCollectionConfig } from '../../collections/config/types.js'
import type { PayloadRequest, Where } from '../../types/index.js'

import { describe, expect, it } from 'vitest'

import { validateQueryPaths } from './validateQueryPaths.js'

const validate = ({ where, hasMany = false }: { where: Where; hasMany?: boolean }) => {
  const field = {
    name: 'mode',
    type: 'select',
    hasMany,
    options: ['online', { label: 'In person', value: 'inPerson' }],
  }
  const collection = { slug: 'posts', flattenedFields: [field] } as SanitizedCollectionConfig
  const req = {
    payload: { config: { localization: false }, collections: { posts: { config: collection } } },
  } as unknown as PayloadRequest
  return validateQueryPaths({ collectionConfig: collection, overrideAccess: true, req, where })
}

describe('select query values (#19231)', () => {
  it.each(['equals', 'not_equals', 'in', 'not_in', 'all'])(
    'should reject unknown %s values before accessing the adapter',
    async (operator) => {
      await expect(
        validate({ where: { mode: { [operator]: ['online', 'invalid'] } } }),
      ).rejects.toMatchObject({ status: 400 })
    },
  )
  it('should validate comma-separated lists and hasMany membership', async () => {
    await expect(validate({ where: { mode: { in: 'online,invalid' } } })).rejects.toMatchObject({
      status: 400,
    })
    await expect(
      validate({ where: { mode: { contains: 'invalid' } }, hasMany: true }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(validate({ where: { mode: { in: 'online,inPerson' } } })).resolves.toBeUndefined()
  })
  it.each([null, 'online', 'inPerson'])(
    'should retain valid and null equality queries: %s',
    async (value) => {
      await expect(validate({ where: { mode: { equals: value } } })).resolves.toBeUndefined()
    },
  )
  it('should retain existence and pattern queries', async () => {
    await expect(validate({ where: { mode: { exists: true } } })).resolves.toBeUndefined()
    await expect(validate({ where: { mode: { like: 'on' } } })).resolves.toBeUndefined()
  })
  it('should reject the literal string null unless configured as an option', async () => {
    await expect(validate({ where: { mode: { equals: 'null' } } })).rejects.toMatchObject({
      status: 400,
    })
  })
})
