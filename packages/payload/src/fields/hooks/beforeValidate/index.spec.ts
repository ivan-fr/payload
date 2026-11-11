import type { SanitizedCollectionConfig } from '../../../collections/config/types.js'
import type { JsonObject, PayloadRequest } from '../../../types/index.js'
import type { Field } from '../../config/types.js'

import { describe, expect, it } from 'vitest'

import { beforeValidate } from './index.js'

type FieldAccessResult = {
  accessResult: boolean
  path: string
}

const runBeforeValidate = async ({
  fields,
  overrideAccess = false,
}: {
  fields: Field[]
  overrideAccess?: boolean
}): Promise<FieldAccessResult[]> => {
  const fieldAccessResults: FieldAccessResult[] = []

  await beforeValidate({
    collection: { fields } as SanitizedCollectionConfig,
    context: {},
    data: Object.fromEntries(fields.map((field) => ['name' in field ? field.name : '', 'value'])),
    doc: {} as JsonObject,
    global: null,
    onFieldAccess: (fieldAccessResult) => {
      fieldAccessResults.push(fieldAccessResult)
    },
    operation: 'create',
    overrideAccess,
    req: { context: {}, payload: {} } as PayloadRequest,
  })

  return fieldAccessResults
}

describe('beforeValidate field access results', () => {
  it.each(['relationship', 'upload'] as const)(
    'should explicitly clear an absent hasMany %s on restore and preserve denied values',
    async (type) => {
      const fields: Field[] = [
        { name: 'allowed', type, relationTo: 'media', hasMany: true },
        {
          name: 'denied',
          type,
          relationTo: 'media',
          hasMany: true,
          access: { update: () => false },
        },
      ]
      const doc = { allowed: ['old'], denied: ['protected'] }
      const run = (isRestoringVersion: boolean) =>
        beforeValidate({
          collection: { fields } as SanitizedCollectionConfig,
          context: { isRestoringVersion },
          data: {} as JsonObject,
          doc,
          global: null,
          operation: 'update',
          overrideAccess: false,
          req: { context: { isRestoringVersion }, payload: { config: {} } } as PayloadRequest,
        })

      expect(await run(true)).toEqual({ allowed: [], denied: ['protected'] })
      expect(await run(false)).toEqual({ allowed: ['old'], denied: ['protected'] })
    },
  )

  it('should report explicit and implicit field access results', async () => {
    const fieldAccessResults = await runBeforeValidate({
      fields: [
        {
          name: 'explicitlyAllowed',
          type: 'text',
          access: { create: () => true },
        },
        {
          name: 'explicitlyDenied',
          type: 'text',
          access: { create: () => false },
        },
        {
          name: 'implicitlyAllowed',
          type: 'text',
        },
      ],
    })

    expect(fieldAccessResults).toHaveLength(3)
    expect(fieldAccessResults).toEqual(
      expect.arrayContaining([
        { accessResult: true, path: 'explicitlyAllowed' },
        { accessResult: false, path: 'explicitlyDenied' },
        { accessResult: true, path: 'implicitlyAllowed' },
      ]),
    )
  })

  it('should report access as allowed when access control is overridden', async () => {
    const fieldAccessResults = await runBeforeValidate({
      fields: [
        {
          name: 'overridden',
          type: 'text',
          access: { create: () => false },
        },
      ],
      overrideAccess: true,
    })

    expect(fieldAccessResults).toEqual([{ accessResult: true, path: 'overridden' }])
  })
})
