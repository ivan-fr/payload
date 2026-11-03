import type { Field, GraphQLInfo } from 'payload'

import { coerceInputValue, isNonNullType } from 'graphql'
import { sanitizeConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import { buildMutationInputType } from './buildMutationInputType.js'

const fields: Field[] = [
  {
    type: 'tabs',
    tabs: [
      { name: 'meta', fields: [{ name: 'title', type: 'text', required: true }] },
      { name: 'optional', fields: [{ name: 'title', type: 'text' }] },
      {
        name: 'nested',
        fields: [
          {
            name: 'group',
            type: 'group',
            fields: [{ name: 'title', type: 'text', required: true }],
          },
        ],
      },
      {
        name: 'hiddenOnly',
        fields: [
          { name: 'secret', type: 'text', required: true, hidden: true },
          { name: 'visible', type: 'text' },
        ],
      },
    ],
  },
]

describe('named tab mutation inputs (#19056)', () => {
  it.each([false, true])(
    'should enforce required tab subfields with forceNullable=%s',
    (forceNullable) => {
      const type = buildMutationInputType({
        name: forceNullable ? 'UpdatePost' : 'CreatePost',
        parentName: 'Post',
        config: sanitizeConfig({ secret: 'test', collections: [] }),
        fields,
        forceNullable,
        parentIsLocalized: false,
        graphqlResult: {} as GraphQLInfo,
      })!

      expect(isNonNullType(type.getFields().meta.type)).toBe(!forceNullable)
      expect(isNonNullType(type.getFields().nested.type)).toBe(!forceNullable)
      expect(isNonNullType(type.getFields().optional.type)).toBe(false)
      expect(isNonNullType(type.getFields().hiddenOnly.type)).toBe(false)
      const errors: string[] = []

      coerceInputValue({}, type, (_path, _value, error) => errors.push(error.message))
      expect(errors).toHaveLength(forceNullable ? 0 : 2)
    },
  )
})
