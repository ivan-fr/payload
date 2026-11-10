import type { I18nClient } from '@payloadcms/translations'
import type { AdminViewAdapter, MetaConfig, SanitizedConfig } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { generatePageMetadata } from './generatePageMetadata.js'

describe('custom authentication route metadata (#11580)', () => {
  it.each([
    ['login', '/sign-in'],
    ['login', '/auth/sign-in'],
    ['forgot', '/auth/forgot-password'],
    ['createFirstUser', '/welcome/create-user'],
    ['unauthorized', '/auth/forbidden'],
    ['reset', '/auth/reset/token'],
  ])('should resolve %s metadata on %s', async (key, route) => {
    const expected = { title: key, icons: { icon: '/custom.svg' } }
    const generateMetadata = vi.fn(() => expected)
    const config = {
      admin: { routes: { [key]: key === 'reset' ? '/auth/reset' : route }, components: {} },
      routes: { admin: '/admin' },
      collections: [],
      globals: [],
    } as unknown as SanitizedConfig
    const adminViews = {
      [key]: { generateMetadata },
      notFound: { generateMetadata: vi.fn(() => ({ title: 'Not Found' })) },
    } as unknown as AdminViewAdapter<unknown, MetaConfig>
    const result = await generatePageMetadata({
      config,
      adminViews,
      i18n: {} as I18nClient,
      params: { segments: route.slice(1).split('/') },
    })

    expect(result).toEqual(expected)
    expect(generateMetadata).toHaveBeenCalledWith({ config, i18n: {} })
  })
})

vi.mock('../CollectionTrash/generateCollectionTrashMetadata.js', () => ({
  generateCollectionTrashMetadata: () => ({ title: 'trash' }),
}))
vi.mock('../List/generateListViewMetadata.js', () => ({
  generateListViewMetadata: () => ({ title: 'list' }),
}))
vi.mock('../Document/getMetaBySegment.js', () => ({
  getMetaBySegment: ({ collectionConfig }: { collectionConfig?: unknown }) => ({
    title: collectionConfig ? 'document' : 'global',
  }),
}))

describe('metadata route controls', () => {
  it.each([
    ['', 'dashboard'],
    ['account', 'account'],
    ['logout', 'unauthorized'],
    ['users/verify/token', 'verify'],
    ['collections/posts', 'list'],
    ['collections/posts/create', 'document'],
    ['collections/posts/trash', 'trash'],
    ['globals/header', 'global'],
    ['unknown', 'notFound'],
  ])('should retain metadata routing for /%s', async (route, title) => {
    const config = {
      admin: { routes: { login: '/sign-in' }, components: {} },
      routes: { admin: '/admin' },
      collections: [{ slug: 'posts' }],
      globals: [{ slug: 'header' }],
    } as unknown as SanitizedConfig
    const adminViews = Object.fromEntries(
      ['dashboard', 'account', 'unauthorized', 'verify', 'notFound'].map((key) => [
        key,
        { generateMetadata: () => ({ title: key }) },
      ]),
    ) as unknown as AdminViewAdapter<unknown, MetaConfig>
    const result = await generatePageMetadata({
      config,
      adminViews,
      i18n: {} as I18nClient,
      params: { segments: route ? route.split('/') : [] },
    })

    expect(result.title).toBe(title)
  })
})
