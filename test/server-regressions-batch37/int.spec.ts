import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { breadcrumbsSlug, criteriaSlug, pagesSlug, verifiedSlug } from './slugs.js'

test.suite('batch 37 server regressions', { config: './config.ts' }, () => {
  test('should split copied breadcrumb IDs across locales while retaining IDs on ordinary updates', async ({
    payload,
  }) => {
    const english = await payload.create({
      collection: breadcrumbsSlug,
      locale: 'en',
      draft: true,
      data: { title: 'English' },
    })
    const french = await payload.update({
      collection: breadcrumbsSlug,
      id: english.id,
      locale: 'fr',
      draft: true,
      data: { title: 'French', breadcrumbs: english.breadcrumbs },
    })
    const updated = await payload.update({
      collection: breadcrumbsSlug,
      id: english.id,
      locale: 'fr',
      draft: true,
      data: { title: 'French updated' },
    })

    expect(french.breadcrumbs?.[0]?.id).not.toBe(english.breadcrumbs?.[0]?.id)
    expect(updated.breadcrumbs?.[0]?.id).toBe(french.breadcrumbs?.[0]?.id)
    await payload.update({
      collection: breadcrumbsSlug,
      id: english.id,
      locale: 'en',
      data: { _status: 'published' },
      publishAllLocales: true,
    })
    const all = await payload.findByID({
      collection: breadcrumbsSlug,
      id: english.id,
      locale: 'all',
      draft: true,
    })

    expect(all.breadcrumbs.en?.[0].label).toBe('English')
    expect(all.breadcrumbs.fr?.[0].label).toBe('French updated')
  })

  test('should return true on successful verification and reject invalid tokens as documented', async ({
    payload,
  }) => {
    const user = await payload.create({
      collection: verifiedSlug,
      data: { email: 'verify@example.com', password: 'test-password' },
    })
    const raw = await payload.db.findOne({
      collection: verifiedSlug,
      where: { id: { equals: user.id } },
    })

    expect(
      await payload.verifyEmail({ collection: verifiedSlug, token: raw._verificationToken }),
    ).toBe(true)
    await expect(
      payload.verifyEmail({ collection: verifiedSlug, token: raw._verificationToken }),
    ).rejects.toMatchObject({ status: 403 })
  })

  test('should use the draft parent path for a published child read in draft mode', async ({
    payload,
  }) => {
    const parent = await payload.create({
      collection: pagesSlug,
      data: { title: 'Parent', slug: 'about', _status: 'published' },
    })
    const child = await payload.create({
      collection: pagesSlug,
      data: { title: 'Child', slug: 'child', parent: parent.id, _status: 'published' },
    })
    await payload.update({
      collection: pagesSlug,
      id: parent.id,
      draft: true,
      data: { slug: 'about-us' },
    })
    const preview = await payload.findByID({
      collection: pagesSlug,
      id: child.id,
      draft: true,
      context: { computeHierarchyPaths: true },
    })

    expect(preview._status).toBe('published')
    expect(preview._h_slugPath).toBe('about-us/child')
    const previewList = await payload.find({
      collection: pagesSlug,
      where: { id: { equals: child.id } },
      draft: true,
      context: { computeHierarchyPaths: true },
    })
    const published = await payload.findByID({
      collection: pagesSlug,
      id: child.id,
      draft: false,
      context: { computeHierarchyPaths: true },
    })

    expect(previewList.docs[0]?._h_slugPath).toBe('about-us/child')
    expect(published._h_slugPath).toBe('about/child')
    const draftChild = await payload.create({
      collection: pagesSlug,
      draft: true,
      data: { title: 'Draft child', slug: 'draft-child', parent: parent.id },
    })
    const ordinaryRead = await payload.find({
      collection: pagesSlug,
      where: { id: { equals: draftChild.id } },
      context: { computeHierarchyPaths: true },
    })

    expect(ordinaryRead.docs[0]?._h_slugPath).toBe('about/draft-child')
    const req = await createPayloadRequest({ payload, context: { computeHierarchyPaths: true } })
    const args = { collection: pagesSlug, id: child.id, req } as const
    const firstPublished = await payload.findByID({ ...args, draft: false })
    const sharedPreview = await payload.findByID({ ...args, draft: true })
    const publishedAgain = await payload.findByID({ ...args, draft: false })

    expect(firstPublished._h_slugPath).toBe('about/child')
    expect(sharedPreview._h_slugPath).toBe('about-us/child')
    expect(publishedAgain._h_slugPath).toBe('about/child')
  })

  test('should validate recursive field-local JSON schemas after generating their types', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: criteriaSlug,
      data: { filter: { condition: { value: 'root', and: [{ value: 'child' }] } } },
    })

    expect(doc.filter.condition.and[0].value).toBe('child')
    await expect(
      payload.create({ collection: criteriaSlug, data: { filter: { condition: { value: 123 } } } }),
    ).rejects.toMatchObject({ status: 400 })
  })
})
