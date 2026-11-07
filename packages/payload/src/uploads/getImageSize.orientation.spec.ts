import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { expect, it } from 'vitest'

import { getImageSize } from './getImageSize.js'

it.each([1, 2, 3, 4, 5, 6, 7, 8])(
  'should report displayed JPEG dimensions in memory and on disk for EXIF %s (#18383)',
  async (orientation) => {
    const data = await sharp({
      create: { width: 120, height: 80, channels: 3, background: '#888' },
    })
      .jpeg()
      .withMetadata({ orientation })
      .toBuffer()
    const directory = await mkdtemp(path.join(os.tmpdir(), 'payload-exif-'))
    const tempFilePath = path.join(directory, 'photo.jpg')

    try {
      await writeFile(tempFilePath, data)
      const expected = orientation >= 5 ? { width: 80, height: 120 } : { width: 120, height: 80 }

      expect(await getImageSize({ file: { data } as never })).toEqual(expected)
      expect(
        await getImageSize({ file: { data: Buffer.alloc(0), tempFilePath } as never }),
      ).toEqual(expected)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)
