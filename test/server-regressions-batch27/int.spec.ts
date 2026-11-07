import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { notesSlug, pagesSlug } from './slugs.js'

test.suite('draft ID search and request files (#15648, #15975)', { config: './config.ts' }, () => {
  test('should search draft titles alongside numeric parent IDs without dropping text matches', async ({
    payload,
  }) => {
    await payload.create({
      collection: pagesSlug,
      overrideAccess: true,
      draft: true,
      data: { title: 'Needle' },
    })
    const result = await payload.find({
      collection: pagesSlug,
      overrideAccess: true,
      draft: true,
      where: { or: [{ id: { equals: 'Needle' } }, { title: { like: 'Needle' } }] },
    })
    expect(result.totalDocs).toBe(1)
    expect(result.docs[0]?.title).toBe('Needle')
  })

  for (const operation of ['create', 'update', 'bulk', 'failure'] as const) {
    test(`should isolate req.file during nested ${operation} and retain shared context`, async ({
      payload,
    }) => {
      const existing = await payload.create({
        collection: notesSlug,
        overrideAccess: true,
        data: { title: 'Initial' },
      })
      const req = await createPayloadRequest({ payload })
      const file = {
        name: 'outer.txt',
        data: Buffer.from('outer'),
        mimetype: 'text/plain',
        size: 5,
      }
      req.file = file
      req.context.captureFile = true
      const operations = {
        create: () =>
          payload.create({
            collection: notesSlug,
            req,
            overrideAccess: true,
            data: { title: 'Inner' },
          }),
        failure: () =>
          payload.create({ collection: notesSlug, req, overrideAccess: true, data: { title: '' } }),
        update: () =>
          payload.update({
            collection: notesSlug,
            req,
            overrideAccess: true,
            id: existing.id,
            data: { title: 'Updated' },
          }),
        bulk: () =>
          payload.update({
            collection: notesSlug,
            req,
            overrideAccess: true,
            where: { id: { equals: existing.id } },
            data: { title: 'Updated' },
          }),
      }
      const error = await operations[operation]().then(
        () => null,
        (error: Error) => error.name,
      )
      expect(error).toBe(operation === 'failure' ? 'ValidationError' : null)
      expect(req.file).toBe(file)
      expect(req.context.observedFile).toBeUndefined()
    })
  }
  test('should expose a nested explicit file without replacing the caller file', async ({
    payload,
  }) => {
    const req = await createPayloadRequest({ payload })
    const outerFile = {
      name: 'outer.txt',
      data: Buffer.from('outer'),
      mimetype: 'text/plain',
      size: 5,
    }
    const innerFile = {
      name: 'inner.txt',
      data: Buffer.from('inner'),
      mimetype: 'text/plain',
      size: 5,
    }
    req.file = outerFile
    req.context.captureFile = true
    await payload.create({
      collection: notesSlug,
      req,
      file: innerFile,
      overrideAccess: true,
      data: { title: 'Nested file' },
    })
    expect(req.file).toBe(outerFile)
    expect(req.context.observedFile).toBe(innerFile)
  })
})
