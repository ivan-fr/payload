import type { Payload, Where } from 'payload'

import { mergeData } from '@payloadcms/live-preview'
import { expect } from 'vitest'

import type { Batch29Target } from './payload-types.js'

import { test } from '../__helpers/int/vitest.js'
import { articlesSlug, previewGlobalSlug, previewPagesSlug, targetsSlug } from './slugs.js'

test.suite('batch 29 backend regressions', { config: './config.ts' }, () => {
  test('should populate flattened localized containers in collection live preview (#19479)', async ({
    payload,
    restClient,
  }) => {
    const target = await payload.create({
      overrideAccess: true,
      collection: targetsSlug,
      data: { title: 'Target' },
    })
    const doc = await payload.create({
      overrideAccess: true,
      collection: previewPagesSlug,
      locale: 'en',
      data: previewData({ id: target.id }),
    })
    const flattened = await payload.findByID({
      overrideAccess: true,
      collection: previewPagesSlug,
      id: doc.id,
      locale: 'en',
      depth: 0,
    })
    const result = await mergeData({
      collectionSlug: previewPagesSlug,
      serverURL: restClient.serverURL,
      initialData: flattened,
      incomingData: flattened,
      locale: 'en',
      depth: 1,
      requestHandler: ({ data, endpoint }) =>
        restClient.POST(`/${endpoint}`, {
          body: JSON.stringify(data),
          headers: { 'X-Payload-HTTP-Method-Override': 'GET' },
        }),
    })

    expect(result).toMatchObject(populatedPreview({ id: target.id }))
  })

  test('should populate flattened localized containers in global live preview (#19479)', async ({
    payload,
    restClient,
  }) => {
    const target = await payload.create({
      overrideAccess: true,
      collection: targetsSlug,
      data: { title: 'Target' },
    })

    await payload.updateGlobal({
      overrideAccess: true,
      slug: previewGlobalSlug,
      locale: 'en',
      data: previewData({ id: target.id }),
    })

    const flattened = await payload.findGlobal({
      overrideAccess: true,
      slug: previewGlobalSlug,
      locale: 'en',
      depth: 0,
    })
    const result = await mergeData({
      globalSlug: previewGlobalSlug,
      serverURL: restClient.serverURL,
      initialData: flattened,
      incomingData: flattened,
      locale: 'en',
      depth: 1,
      requestHandler: ({ data, endpoint }) =>
        restClient.POST(`/${endpoint}`, {
          body: JSON.stringify(data),
          headers: { 'X-Payload-HTTP-Method-Override': 'GET' },
        }),
    })

    expect(result).toMatchObject(populatedPreview({ id: target.id }))
  })

  test('should preserve locale maps and ordinary locale flattening (#19479)', async ({
    payload,
  }) => {
    const target = await payload.create({
      overrideAccess: true,
      collection: targetsSlug,
      data: { title: 'Target' },
    })
    const doc = await payload.create({
      overrideAccess: true,
      collection: previewPagesSlug,
      locale: 'en',
      data: previewData({ id: target.id }),
    })

    await payload.update({
      overrideAccess: true,
      collection: previewPagesSlug,
      id: doc.id,
      locale: 'fr',
      data: { hero: { mode: 'French', en: 'French child' } },
    })

    const raw = await payload.findByID({
      overrideAccess: true,
      collection: previewPagesSlug,
      id: doc.id,
      depth: 0,
      locale: 'all',
    })

    for (const options of [
      { locale: 'all', flattenLocales: false },
      { locale: 'all', flattenLocales: true },
      { locale: 'en', flattenLocales: false },
    ] as const) {
      const result = await payload.findByID({
        overrideAccess: true,
        collection: previewPagesSlug,
        id: doc.id,
        depth: 1,
        data: { ...structuredClone(raw) },
        ...options,
      })

      expect(result).toMatchObject({
        hero: {
          en: { mode: 'plain', items: [{ target: { id: target.id, title: 'Target' } }] },
          fr: { mode: 'French' },
        },
      })
    }

    const result = await payload.findByID({
      overrideAccess: true,
      collection: previewPagesSlug,
      id: doc.id,
      locale: 'fr',
      depth: 0,
    })

    expect(result.hero).toMatchObject({ mode: 'French', en: 'French child' })
  })

  test('should populate flattened supplied data through the Local API (#19479)', async ({
    payload,
  }) => {
    const target = await payload.create({
      overrideAccess: true,
      collection: targetsSlug,
      data: { title: 'Target' },
    })
    const doc = await payload.create({
      overrideAccess: true,
      collection: previewPagesSlug,
      locale: 'en',
      data: previewData({ id: target.id }),
    })
    const flattened = await payload.findByID({
      overrideAccess: true,
      collection: previewPagesSlug,
      id: doc.id,
      locale: 'en',
      depth: 0,
    })
    const result = await payload.findByID({
      overrideAccess: true,
      collection: previewPagesSlug,
      id: doc.id,
      locale: 'en',
      depth: 1,
      data: { ...flattened },
      isLocalizedDataFlattened: true,
    })

    expect(result).toMatchObject(populatedPreview({ id: target.id }))
  })

  test('should ignore the flattened-data flag for persisted reads and keep hidden fields private', async ({
    payload,
    restClient,
  }) => {
    const target = await payload.create({
      overrideAccess: true,
      collection: targetsSlug,
      data: { title: 'Target' },
    })
    const doc = await payload.create({
      overrideAccess: true,
      collection: previewPagesSlug,
      locale: 'en',
      data: previewData({ id: target.id }),
    })

    await payload.updateGlobal({
      overrideAccess: true,
      slug: previewGlobalSlug,
      locale: 'en',
      data: previewData({ id: target.id }),
    })

    for (const path of [
      `/${previewPagesSlug}/${doc.id}`,
      `/globals/${previewGlobalSlug}`,
    ] as const) {
      const response = await restClient.GET(path, {
        query: { locale: 'en', depth: 0, isLocalizedDataFlattened: 'true' },
      })

      expect(response.status).toBe(200)

      const result = await response.json()

      expect(result.hero.mode).toBe('plain')
      expect(JSON.stringify(result)).not.toContain('Private test text')
    }
  })

  test('should remove the pending string-ID job when deleting a numeric-ID document (#19448)', async ({
    payload,
  }) => {
    const doc = await payload.create({
      overrideAccess: true,
      collection: articlesSlug,
      data: { title: 'Delete me' },
    })
    const retained = await payload.create({
      overrideAccess: true,
      collection: articlesSlug,
      data: { title: 'Keep me' },
    })
    const job = await queuePublish({ payload, id: doc.id })
    const numericJob = await payload.jobs.queue({
      overrideAccess: true,
      task: 'schedulePublish',
      input: { doc: { relationTo: articlesSlug, value: doc.id }, type: 'publish' },
      waitUntil: new Date(Date.now() + 3_600_000),
    })
    const retainedJob = await queuePublish({ payload, id: retained.id })

    await payload.delete({
      overrideAccess: true,
      collection: articlesSlug,
      id: doc.id,
    })

    const jobs = await payload.find({
      overrideAccess: true,
      collection: 'payload-jobs',
      pagination: false,
    })

    expect(jobs.docs.map(({ id }) => id)).not.toContain(job.id)
    expect(jobs.docs.map(({ id }) => id)).not.toContain(numericJob.id)
    expect(jobs.docs.map(({ id }) => id)).toContain(retainedJob.id)
  })

  test('should remove only matching pending jobs on bulk deletion (#19448)', async ({
    payload,
  }) => {
    const first = await payload.create({
      overrideAccess: true,
      collection: articlesSlug,
      data: { title: 'First' },
    })
    const second = await payload.create({
      overrideAccess: true,
      collection: articlesSlug,
      data: { title: 'Second' },
    })
    const retained = await payload.create({
      overrideAccess: true,
      collection: articlesSlug,
      data: { title: 'Keep' },
    })
    const firstJob = await queuePublish({ payload, id: first.id })
    const secondJob = await queuePublish({ payload, id: second.id })
    const numericJob = await payload.jobs.queue({
      overrideAccess: true,
      task: 'schedulePublish',
      input: { doc: { relationTo: articlesSlug, value: second.id }, type: 'publish' },
      waitUntil: new Date(Date.now() + 3_600_000),
    })
    const retainedJob = await queuePublish({ payload, id: retained.id })
    const completedJob = await queuePublish({ payload, id: first.id })

    await payload.update({
      overrideAccess: true,
      collection: 'payload-jobs',
      id: completedJob.id,
      data: { completedAt: new Date().toISOString() },
    })
    await payload.delete({
      overrideAccess: true,
      collection: articlesSlug,
      where: { id: { in: [first.id, second.id] } },
    })

    const jobs = await payload.find({
      overrideAccess: true,
      collection: 'payload-jobs',
      pagination: false,
    })
    const jobIDs = jobs.docs.map(({ id }) => id)

    expect(jobIDs).not.toContain(firstJob.id)
    expect(jobIDs).not.toContain(secondJob.id)
    expect(jobIDs).not.toContain(numericJob.id)
    expect(jobIDs).toContain(retainedJob.id)
    expect(jobIDs).toContain(completedJob.id)
  })

  test.options(
    'should query sibling block fields together without duplicate joins (#19459)',
    { db: 'drizzle' },
    async ({ payload }) => {
      const doc = await payload.create({
        overrideAccess: true,
        collection: articlesSlug,
        data: {
          title: 'Match',
          layout: [{ blockType: 'card', heading: 'needle', caption: 'caption' }],
        },
      })

      await payload.create({
        overrideAccess: true,
        collection: articlesSlug,
        data: {
          title: 'Other',
          layout: [{ blockType: 'card', heading: 'other', caption: 'other' }],
        },
      })

      for (const where of [
        {
          or: [
            { 'layout.heading': { equals: 'needle' } },
            { 'layout.caption': { equals: 'caption' } },
          ],
        },
        {
          and: [
            { 'layout.heading': { equals: 'needle' } },
            { 'layout.caption': { equals: 'caption' } },
          ],
        },
      ] as Where[]) {
        const result = await payload.find({
          overrideAccess: true,
          collection: articlesSlug,
          where,
        })

        expect(result.docs.map(({ id }) => id)).toEqual([doc.id])
      }
    },
  )
})

function previewData({ id }: { id: Batch29Target['id'] }) {
  return {
    hero: {
      mode: 'plain',
      internal: 'Private test text',
      en: 'A child named like a locale',
      items: [{ label: 'Item', target: id }],
    },
    details: { mode: 'tab', items: [{ target: id }] },
    rows: [{ target: id }],
    content: [{ blockType: 'related' as const, target: id }],
  }
}

function populatedPreview({ id }: { id: number | string }) {
  const target = { id, title: 'Target' }

  return {
    hero: { mode: 'plain', en: 'A child named like a locale', items: [{ label: 'Item', target }] },
    details: { mode: 'tab', items: [{ target }] },
    rows: [{ target }],
    content: [{ blockType: 'related', target }],
  }
}

function queuePublish({ payload, id }: { id: number | string; payload: Payload }) {
  return payload.jobs.queue({
    overrideAccess: true,
    task: 'schedulePublish',
    // The admin stores string IDs; generated relationship input types use numeric IDs on SQLite.
    input: { doc: { relationTo: articlesSlug, value: String(id) }, type: 'publish' } as never,
    waitUntil: new Date(Date.now() + 3_600_000),
  })
}
