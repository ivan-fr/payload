import { describe, expect, it } from 'vitest'

import { getJPEGOrientation } from './getJPEGOrientation.js'

const exifJPEG = ({
  isLittleEndian,
  orientation = 6,
}: {
  isLittleEndian: boolean
  orientation?: number
}) => {
  const segment = Buffer.alloc(32)
  segment.write('Exif\0\0', 0, 'ascii')
  segment.write(isLittleEndian ? 'II' : 'MM', 6, 'ascii')
  const write16 = (value: number, offset: number) =>
    isLittleEndian
      ? segment.writeUInt16LE(value, offset + 6)
      : segment.writeUInt16BE(value, offset + 6)
  const write32 = (value: number, offset: number) =>
    isLittleEndian
      ? segment.writeUInt32LE(value, offset + 6)
      : segment.writeUInt32BE(value, offset + 6)
  write16(42, 2)
  write32(8, 4)
  write16(1, 8)
  write16(0x0112, 10)
  write16(3, 12)
  write32(1, 14)
  write16(orientation, 18)
  const length = Buffer.alloc(2)
  length.writeUInt16BE(segment.length + 2)
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
    length,
    segment,
    Buffer.from([0xff, 0xd9]),
  ])
}

describe('bounded JPEG EXIF reader', () => {
  it.each([true, false])(
    'should parse orientation in either TIFF byte order (little: %s)',
    async (isLittleEndian) => {
      expect(await getJPEGOrientation({ data: exifJPEG({ isLittleEndian }) })).toBe(6)
    },
  )

  it('should skip an unrelated APP1 segment before EXIF', async () => {
    const jpeg = exifJPEG({ isLittleEndian: true })
    const data = Buffer.concat([
      jpeg.subarray(0, 2),
      Buffer.from([0xff, 0xe1, 0, 4, 65, 66]),
      jpeg.subarray(2),
    ])
    expect(await getJPEGOrientation({ data })).toBe(6)
  })

  it.each([
    Buffer.alloc(0),
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 1]),
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0]),
    exifJPEG({ isLittleEndian: true, orientation: 9 }),
  ])('should ignore truncated or invalid orientation metadata (%#)', async (data) => {
    expect(await getJPEGOrientation({ data })).toBeUndefined()
  })

  it('should stop before scan data and bound repeated fill markers', async () => {
    expect(
      await getJPEGOrientation({
        data: Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff, 0xda]),
          exifJPEG({ isLittleEndian: true }),
        ]),
      }),
    ).toBeUndefined()
    expect(
      await getJPEGOrientation({
        data: Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(10000, 0xff)]),
      }),
    ).toBeUndefined()
  })
})
