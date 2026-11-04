import type { I18nClient } from '@payloadcms/translations'
import type { PartialAdminContext } from 'payload/internal'
import type { ServerAdapter } from 'payload'

import { initI18n } from '@payloadcms/translations'
import { getAccessResults } from 'payload'
import { initAdminContext } from 'payload/internal'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { devUser } from '../credentials.js'
import { cannotCreateDefaultLocale, localizedPostsSlug } from './shared.js'

test.suite('Copied admin locale context', { config: './config.ts' }, () => {
  test('should preserve saved locale preferences and locale-based permissions after copying a scoped request', async ({
    payload,
  }) => {
    const user = (
      await payload.find({
        collection: 'users',
        overrideAccess: true,
        where: { email: { equals: devUser.email } },
      })
    ).docs[0]!
    const authenticatedUser = { ...user, collection: 'users' as const }
    const i18n = await initI18n({ config: payload.config.i18n, context: 'client', language: 'en' })
    const serverAdapter = {
      getHeaders: async () => new Headers(),
      getCookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
    } as unknown as ServerAdapter
    const context = ({ locale }: { locale?: string } = {}) =>
      initAdminContext({
        configPromise: Promise.resolve(payload.config),
        importMap: {},
        key: 'locale-regression',
        serverAdapter,
        cache: {
          getPartial: async (): Promise<PartialAdminContext> => ({
            payload,
            responseHeaders: new Headers(),
            user: authenticatedUser,
            i18n: i18n as I18nClient,
          }),
          getRequest: (create) => create(),
        },
        overrides: { fallbackLocale: false, req: { query: locale ? { locale } : {} } },
      })

    const spanish = await context({ locale: 'es' })
    expect(spanish.req.locale).toBe('es')
    expect(spanish.permissions.collections![cannotCreateDefaultLocale]!.create).toBe(true)
    const post = await payload.create({
      collection: localizedPostsSlug,
      overrideAccess: true,
      data: { title: 'Spanish preference content' },
      req: spanish.req,
    })
    const preferred = await context()
    expect(preferred.locale?.code).toBe('es')
    expect(preferred.req.locale).toBe('es')
    const persisted = await payload.findByID({
      collection: localizedPostsSlug,
      id: post.id,
      overrideAccess: true,
      req: preferred.req,
    })
    expect(persisted.title).toBe('Spanish preference content')

    const english = await context({ locale: 'en' })
    expect(english.req.locale).toBe('en')
    expect(english.permissions.collections![cannotCreateDefaultLocale]!.create).toBeUndefined()
    const copiedPermissions = await getAccessResults({ req: { ...english.req } })
    expect(copiedPermissions.collections![cannotCreateDefaultLocale]!.create).toBeUndefined()
  })
})
