import type { SanitizedConfig } from 'payload'

import { graphql, GraphQLObjectType, GraphQLSchema } from 'graphql'
import { sanitizeConfig } from 'payload'
import { sanitizePermissions } from 'payload/internal'
import { describe, expect, it } from 'vitest'

import { buildPoliciesType } from './buildPoliciesType.js'

describe('global policy type names', () => {
  it('should use the configured GraphQL name for a global access type', () => {
    const config = {
      collections: [],
      globals: [{ slug: 'settings', fields: [], graphQL: { name: 'SiteSettings' } }],
    } as unknown as SanitizedConfig
    const fields = buildPoliciesType(config).getFields()

    expect(String(fields.settings.type)).toBe('SiteSettingsAccess')
  })

  it('should fall back to the global slug when no GraphQL name is set', () => {
    const config = {
      collections: [],
      globals: [{ slug: 'settings', fields: [] }],
    } as unknown as SanitizedConfig

    expect(String(buildPoliciesType(config).getFields().settings.type)).toBe('settingsAccess')
  })
})

describe('compact permissions in GraphQL (#19168)', () => {
  it.each([true, false])(
    'should resolve compact entity, field and operation permissions with allowed=%s',
    async (allowed) => {
      const config = sanitizeConfig({
        secret: 'test',
        collections: [
          {
            slug: 'posts',
            fields: [
              { name: 'title', type: 'text' },
              { name: 'meta', type: 'group', fields: [{ name: 'name', type: 'text' }] },
            ],
          },
        ],
        globals: [{ slug: 'settings', fields: [{ name: 'title', type: 'text' }] }],
      })
      const compact = sanitizePermissions({
        canAccessAdmin: allowed,
        collections: {
          posts: {
            create: { permission: allowed },
            read: { permission: allowed },
            fields: {
              title: { read: { permission: allowed } },
              meta: {
                read: { permission: allowed },
                fields: { name: { read: { permission: allowed } } },
              },
            },
          },
        },
        globals: { settings: { read: { permission: allowed } } },
      })
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            Access: {
              type: buildPoliciesType(config),
              resolve: () => ({
                ...compact,
                posts: compact.collections?.posts ?? false,
                settings: compact.globals?.settings ?? false,
              }),
            },
          },
        }),
      })
      const result = await graphql({
        schema,
        source: `{ Access { canAccessAdmin posts { read { permission } update { permission } fields { title { read { permission } } meta { fields { name { read { permission } } } } } } settings { read { permission } } } }`,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.Access).toMatchObject({
        canAccessAdmin: allowed,
        posts: {
          read: { permission: allowed },
          update: { permission: false },
          fields: {
            title: { read: { permission: allowed } },
            meta: { fields: { name: { read: { permission: allowed } } } },
          },
        },
        settings: { read: { permission: allowed } },
      })
    },
  )
})

describe('partial GraphQL tab permissions', () => {
  it('should preserve query constraints and denied siblings inside named tabs', async () => {
    const config = sanitizeConfig({
      secret: 'test',
      collections: [
        {
          slug: 'posts',
          fields: [
            {
              type: 'tabs',
              tabs: [
                {
                  name: 'details',
                  fields: [
                    { name: 'open', type: 'text' },
                    { name: 'secret', type: 'text' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    const where = { id: { equals: 7 } }
    const compact = sanitizePermissions({
      collections: {
        posts: {
          read: { permission: true, where },
          fields: {
            details: {
              fields: {
                open: { read: { permission: true } },
                secret: { read: { permission: false } },
              },
            },
          },
        },
      },
    })
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          Access: {
            type: buildPoliciesType(config),
            resolve: () => ({ posts: compact.collections?.posts }),
          },
        },
      }),
    })
    const result = await graphql({
      schema,
      source:
        '{ Access { posts { read { permission where } fields { details { open { read { permission } } secret { read { permission } } } } } } }',
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.Access).toMatchObject({
      posts: {
        read: { permission: true, where },
        fields: {
          details: {
            open: { read: { permission: true } },
            secret: { read: { permission: false } },
          },
        },
      },
    })
  })
})
