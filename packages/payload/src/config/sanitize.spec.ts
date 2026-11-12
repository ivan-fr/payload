import type { Config } from './types.js'

import { describe, expect, it } from 'vitest'

import { InvalidConfiguration } from '../errors/InvalidConfiguration.js'
import { sanitizeConfig } from './sanitize.js'

const configDefaults: Config = {
  db: {
    defaultIDType: 'text',
    // @ts-expect-error partial config
    init: () => {},
  },
  secret: 'secret',
}

describe('sanitizeConfig', () => {
  it('should populate sanitized root config defaults for a minimal config', () => {
    const config: Config = {
      ...configDefaults,
    }

    const sanitizedConfig = sanitizeConfig(config)

    expect(sanitizedConfig.admin).toMatchObject({
      avatar: 'gravatar',
      components: {},
      custom: {},
      dashboard: {
        defaultLayout: [
          { widgetSlug: 'welcome', width: 'full' },
          { widgetSlug: 'activity', width: 'full' },
          { widgetSlug: 'collections', width: 'full' },
        ],
        widgets: expect.any(Array),
      },
      dateFormat: 'MMMM do yyyy, h:mm a',
      dependencies: {},
      importMap: {
        baseDir: process.cwd(),
      },
      meta: {
        defaultOGImageType: 'dynamic',
        robots: 'noindex, nofollow',
        titleSuffix: '- Payload',
      },
      routes: {
        account: '/account',
        createFirstUser: '/create-first-user',
        forgot: '/forgot',
        inactivity: '/logout-inactivity',
        login: '/login',
        logout: '/logout',
        reset: '/reset',
        unauthorized: '/unauthorized',
      },
      theme: 'all',
      timezones: {
        supportedTimezones: expect.any(Array),
      },
      user: 'users',
    })
    expect(sanitizedConfig.graphQL).toEqual({
      disableIntrospectionInProduction: true,
      disablePlaygroundInProduction: true,
      maxComplexity: 1000,
      schemaOutputFile: `${process.cwd()}/schema.graphql`,
    })
    expect(sanitizedConfig.typescript).toEqual({
      autoGenerate: true,
      outputFile: `${process.cwd()}/payload-types.ts`,
    })
    expect(sanitizedConfig.routes).toEqual({
      admin: '/admin',
      api: '/api',
      graphQL: '/graphql',
      graphQLPlayground: '/graphql-playground',
    })
  })

  it('should throw for unsupported password hash iterations', () => {
    expect(() =>
      sanitizeConfig({
        ...configDefaults,
        // @ts-expect-error unsupported value from an untyped config
        auth: { passwordHashIterations: 200000 },
      }),
    ).toThrow(InvalidConfiguration)
  })

  it('should populate a nested default when the property is explicitly undefined', () => {
    const config: Config = {
      ...configDefaults,
      admin: {
        avatar: undefined,
      },
    }

    const sanitizedConfig = sanitizeConfig(config)

    expect(sanitizedConfig.admin.avatar).toBe('gravatar')
  })

  it('should populate sanitized localization defaults with no locales', () => {
    const config: Config = {
      ...configDefaults,
      localization: {
        defaultLocale: 'en',
        locales: [],
      },
    }

    const sanitizedConfig = sanitizeConfig(config)

    expect(sanitizedConfig.localization).toEqual({
      defaultLocale: 'en',
      fallback: true,
      localeCodes: [],
      locales: [],
    })
  })

  it('should reject a locale object without a code before the config is used (#17858)', () => {
    expect(() =>
      sanitizeConfig({
        ...configDefaults,
        localization: {
          defaultLocale: 'en',
          locales: [
            // @ts-expect-error locale objects from an untyped config using the wrong key
            { label: 'English', value: 'en' },
            // @ts-expect-error locale objects from an untyped config using the wrong key
            { label: 'French', value: 'fr' },
          ],
        },
      }),
    ).toThrow('localization.locales[0] is missing a "code"')
  })
})

describe('slug uniqueness (#18584)', () => {
  it('should reject duplicate global slugs', () => {
    expect(() =>
      sanitizeConfig({
        ...configDefaults,
        globals: [
          { slug: 'settings', fields: [] },
          { slug: 'settings', fields: [] },
        ],
      }),
    ).toThrow(/Global.*already in use/)
  })
  it('should reject collection/global collisions including internal collections', () => {
    for (const slug of ['posts', 'payload-migrations']) {
      expect(() =>
        sanitizeConfig({
          ...configDefaults,
          collections: [{ slug: 'posts', fields: [] }],
          globals: [{ slug, fields: [] }],
        }),
      ).toThrow(/slug.*already in use/)
    }
  })
  it('should allow distinct slugs with identical labels', () => {
    expect(() =>
      sanitizeConfig({
        ...configDefaults,
        globals: [
          { slug: 'settings', label: 'Settings', fields: [] },
          { slug: 'other', label: 'Settings', fields: [] },
        ],
      }),
    ).not.toThrow()
  })
})
