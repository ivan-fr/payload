import type { Block, Field, GraphQLInfo } from 'payload'

import { graphql, GraphQLObjectType, GraphQLSchema } from 'graphql'
import { sanitizeConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import { configToSchema } from '../index.js'
import { buildObjectType } from './buildObjectType.js'

const makeBlock = ({ name, flag }: { name: string; flag: string }): Block => ({
  slug: 'text',
  interfaceName: name,
  fields: [{ name: flag, type: 'checkbox' }],
})
const makeSchema = ({
  fieldsA,
  fieldsB,
  blocks = [],
}: {
  fieldsA: Field[]
  fieldsB: Field[]
  blocks?: Block[]
}) => {
  const config = sanitizeConfig({ secret: 'test', collections: [], blocks })
  const graphqlResult = {
    types: { arrayTypes: {}, blockTypes: {}, groupTypes: {}, tabTypes: {} },
  } as GraphQLInfo
  const a = buildObjectType({ name: 'A', parentName: 'A', fields: fieldsA, config, graphqlResult })
  const b = buildObjectType({ name: 'B', parentName: 'B', fields: fieldsB, config, graphqlResult })
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        a: { type: a, resolve: () => ({ items: [{ blockType: 'text', showOnA: true }] }) },
        b: { type: b, resolve: () => ({ items: [{ blockType: 'text', showOnB: true }] }) },
      },
    }),
  })
  return { schema, a, b }
}

describe('GraphQL block interfaces (#16769)', () => {
  it.each([false, true])(
    'should preserve both inline block shapes regardless of collection order (reverse: %s)',
    async (reverse) => {
      const fieldsA: Field[] = [
        {
          name: 'items',
          type: 'blocks',
          blocks: [makeBlock({ name: 'ABlockText', flag: 'showOnA' })],
        },
      ]
      const fieldsB: Field[] = [
        {
          name: 'items',
          type: 'blocks',
          blocks: [makeBlock({ name: 'BBlockText', flag: 'showOnB' })],
        },
      ]
      const { schema } = makeSchema({
        fieldsA: reverse ? fieldsB : fieldsA,
        fieldsB: reverse ? fieldsA : fieldsB,
      })
      const result = await graphql({
        schema,
        source: reverse
          ? '{ a { items { __typename ... on BBlockText { showOnB } } } b { items { __typename ... on ABlockText { showOnA } } } }'
          : '{ a { items { __typename ... on ABlockText { showOnA } } } b { items { __typename ... on BBlockText { showOnB } } } }',
      })
      expect(result.errors).toBeUndefined()
      expect(result.data).toMatchObject({
        a: { items: [{ __typename: reverse ? 'BBlockText' : 'ABlockText' }] },
        b: { items: [{ __typename: reverse ? 'ABlockText' : 'BBlockText' }] },
      })
    },
  )
  it('should share one GraphQL type for global block references', async () => {
    const block = makeBlock({ name: 'SharedText', flag: 'showOnA' })
    const fields: Field[] = [{ name: 'items', type: 'blocks', blocks: ['text'] }]
    const { schema } = makeSchema({ fieldsA: fields, fieldsB: fields, blocks: [block] })
    const result = await graphql({
      schema,
      source:
        '{ a { items { __typename ... on SharedText { showOnA } } } b { items { __typename } } }',
    })
    expect(result.errors).toBeUndefined()
    expect(result.data).toMatchObject({
      a: { items: [{ showOnA: true }] },
      b: { items: [{ __typename: 'SharedText' }] },
    })
  })
})

it('should expose both interfaces through the Payload GraphQL schema for sanitized collections', async () => {
  const config = sanitizeConfig({
    secret: 'test',
    db: { defaultIDType: 'number' } as never,
    collections: [
      {
        slug: 'a',
        timestamps: false,
        authorship: false,
        versions: false,
        fields: [
          {
            name: 'items',
            type: 'blocks',
            blocks: [makeBlock({ name: 'ABlockText', flag: 'showOnA' })],
          },
        ],
      },
      {
        slug: 'b',
        timestamps: false,
        authorship: false,
        versions: false,
        fields: [
          {
            name: 'items',
            type: 'blocks',
            blocks: [makeBlock({ name: 'BBlockText', flag: 'showOnB' })],
          },
        ],
      },
    ],
  })
  config.collections = config.collections.filter(({ slug }) => slug === 'a' || slug === 'b')
  const { schema } = configToSchema(config)
  const result = await graphql({
    schema,
    source:
      '{ a: __type(name: "ABlockText") { fields { name } } b: __type(name: "BBlockText") { fields { name } } }',
  })
  expect(result.errors).toBeUndefined()
  expect(result.data).toMatchObject({
    a: { fields: expect.arrayContaining([{ name: 'showOnA' }]) },
    b: { fields: expect.arrayContaining([{ name: 'showOnB' }]) },
  })
})

it('should retain one lazily resolved type for a recursive global block', async () => {
  const block: Block = {
    slug: 'text',
    interfaceName: 'RecursiveText',
    fields: [{ name: 'children', type: 'blocks', blocks: ['text'] }],
  }
  const fields: Field[] = [{ name: 'items', type: 'blocks', blocks: ['text'] }]
  const { schema } = makeSchema({ fieldsA: fields, fieldsB: fields, blocks: [block] })
  const result = await graphql({
    schema,
    source: '{ a { items { __typename ... on RecursiveText { children { __typename } } } } }',
  })
  expect(result.errors).toBeUndefined()
  expect(result.data).toMatchObject({ a: { items: [{ __typename: 'RecursiveText' }] } })
})
