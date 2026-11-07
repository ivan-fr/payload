import type { PayloadRequest } from 'payload'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { createPrepareLegacyUpload } from './prepareLegacyUpload.js'
import { createTransformFile } from './transformFile.js'

describe('EXIF-oriented uploads (#18383, #19165)', () => {
  it.each([1, 5, 6, 7, 8])(
    'should preserve viewer dimensions and size limits for orientation %s',
    async (orientation) => {
      const data = await sharp({
        create: { width: 300, height: 200, channels: 3, background: '#888' },
      })
        .jpeg()
        .withMetadata({ orientation })
        .toBuffer()
      const file = new File([data], 'photo.jpg', { type: 'image/jpeg' })
      const req = {
        payload: { collections: { media: { config: { upload: {} } } } },
      } as unknown as PayloadRequest
      const transformFile = createTransformFile({ sharpDependency: sharp })
      const prepare = createPrepareLegacyUpload({
        collections: {
          media: { variants: [{ name: 'full', width: 240, withoutEnlargement: true }] },
        },
        sharpDependency: sharp,
      })

      const results = await prepare({
        collectionSlug: 'media',
        file,
        req,
        uploadEdits: { focalPoint: { x: 50, y: 50 } },
        transform: async ({ options }) =>
          (await transformFile({ file, options: options as never, req })).file ?? file,
      })
      const isRotated = orientation >= 5

      const variant = results.find((result) => result.fieldPath === 'variants.full')!
      expect(variant).toMatchObject(
        isRotated ? { width: 200, height: 300 } : { width: 240, height: 160 },
      )
      expect(await sharp(Buffer.from(await variant.file!.arrayBuffer())).metadata()).toMatchObject(
        isRotated ? { width: 200, height: 300 } : { width: 240, height: 160 },
      )
      expect(results[0]).toMatchObject(
        isRotated ? { width: 200, height: 300 } : { width: 300, height: 200 },
      )
    },
  )
})
