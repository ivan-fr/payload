import type { PayloadRequest, Where } from 'payload'

import { verifyClientUploadReceipt } from 'payload/internal'
import { describe, expect, it, vi } from 'vitest'

import { resolveSignedURLKey } from './resolveSignedURLKey.js'

function matches({ doc, where }: { doc: Record<string, unknown>; where: Where }): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'and') return (condition as Where[]).every((where) => matches({ doc, where }))
    if (key === 'or') return (condition as Where[]).some((where) => matches({ doc, where }))
    return doc[key] === (condition as { equals: unknown }).equals
  })
}

describe('client upload filename uniqueness', () => {
  it.each([
    { compound: true, existingPrefix: 'media/a', docPrefix: 'media/b', expected: 'logo.png' },
    { compound: true, existingPrefix: 'media/b', docPrefix: 'media/b', expected: 'logo-1.png' },
    { compound: false, existingPrefix: 'media/a', docPrefix: 'media/b', expected: 'logo-1.png' },
    {
      compound: true,
      existingPrefix: 'a',
      docPrefix: '',
      collectionPrefix: '',
      expected: 'logo.png',
    },
    { compound: true, existingPrefix: 'a', docPrefix: 'b', composite: true, expected: 'logo.png' },
  ])(
    'should resolve $expected for prefix $docPrefix (compound: $compound)',
    async ({
      compound,
      existingPrefix,
      docPrefix,
      expected,
      collectionPrefix = 'media',
      composite = false,
    }) => {
      const doc = { filename: 'logo-original.png', prefix: existingPrefix }
      const findOne = vi.fn(({ where }: { where: Where }) => (matches({ doc, where }) ? doc : null))
      const req = {
        payload: {
          secret: 'test-secret',
          collections: {
            media: {
              config: {
                fields: [{ name: 'prefix', type: 'text' }],
                upload: { filenameCompoundIndex: compound ? ['filename', 'prefix'] : undefined },
              },
            },
          },
          db: { findOne },
        },
      } as unknown as PayloadRequest

      const result = await resolveSignedURLKey({
        collectionSlug: 'media',
        collectionPrefix,
        docPrefix,
        filename: 'logo.png',
        req,
        useCompositePrefixes: composite,
      })

      expect(result.sanitizedFilename).toBe(expected)
      expect(
        verifyClientUploadReceipt({ req, signedReceipt: result.uploadReference.signedReceipt }),
      ).toMatchObject({
        filename: expected,
        filePrefix: result.sanitizedDocPrefix,
        storageFilePath: result.storageFilePath,
      })
      if (compound) {
        expect(findOne).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              and: expect.arrayContaining([{ prefix: { equals: result.sanitizedDocPrefix } }]),
            }),
          }),
        )
      } else {
        expect(findOne.mock.calls[0]?.[0].where).not.toHaveProperty('and')
      }
    },
  )
})
