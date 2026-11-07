import fs from 'node:fs/promises'

/** Reads only JPEG marker headers and bounded APP1 segments, never compressed image data. */
export async function getJPEGOrientation({
  data,
  tempFilePath,
}: {
  data?: Buffer
  tempFilePath?: string
}): Promise<number | undefined> {
  const handle = tempFilePath ? await fs.open(tempFilePath, 'r') : undefined
  const read = createReader({ data, handle })

  try {
    const signature = await read({ length: 2, position: 0 })
    if (signature.length !== 2 || signature.readUInt16BE(0) !== 0xffd8) {
      return undefined
    }

    return await readJPEGMarkers({ read })
  } finally {
    await handle?.close()
  }
}

function readExifOrientation({ segment }: { segment: Buffer }): number | undefined {
  if (segment.length < 14 || segment.toString('ascii', 0, 6) !== 'Exif\0\0') {
    return undefined
  }
  const tiff = segment.subarray(6)
  const byteOrder = tiff.toString('ascii', 0, 2)
  if (byteOrder !== 'II' && byteOrder !== 'MM') {
    return undefined
  }
  const read16 = ({ offset }: { offset: number }) =>
    byteOrder === 'II' ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset)
  const read32 = ({ offset }: { offset: number }) =>
    byteOrder === 'II' ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset)
  if (read16({ offset: 2 }) !== 42) {
    return undefined
  }
  const directoryOffset = read32({ offset: 4 })
  if (directoryOffset < 8 || directoryOffset > tiff.length - 2) {
    return undefined
  }
  const count = read16({ offset: directoryOffset })

  for (let i = 0; i < count; i++) {
    const offset = directoryOffset + 2 + i * 12
    if (offset > tiff.length - 12) {
      return undefined
    }
    if (
      read16({ offset }) === 0x0112 &&
      read16({ offset: offset + 2 }) === 3 &&
      read32({ offset: offset + 4 }) === 1
    ) {
      const orientation = read16({ offset: offset + 8 })
      return orientation >= 1 && orientation <= 8 ? orientation : undefined
    }
  }
  return undefined
}

type ReadJPEGBytes = (args: { length: number; position: number }) => Promise<Buffer>

const createReader = ({
  data,
  handle,
}: {
  data?: Buffer
  handle?: fs.FileHandle
}): ReadJPEGBytes => {
  return async ({ length, position }: { length: number; position: number }): Promise<Buffer> => {
    if (!handle) {
      return data?.subarray(position, position + length) ?? Buffer.alloc(0)
    }
    const buffer = Buffer.alloc(length)
    let totalRead = 0
    while (totalRead < length) {
      const { bytesRead } = await handle.read(
        buffer,
        totalRead,
        length - totalRead,
        position + totalRead,
      )
      if (bytesRead === 0) {
        break
      }
      totalRead += bytesRead
    }
    return buffer.subarray(0, totalRead)
  }
}

const isStandaloneMarker = ({ marker }: { marker: number }): boolean =>
  marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)

const readSegment = async ({
  marker,
  position,
  read,
}: {
  marker: number
  position: number
  read: ReadJPEGBytes
}): Promise<{ length: number; orientation?: number } | undefined> => {
  const lengthBytes = await read({ length: 2, position })
  if (lengthBytes.length !== 2) {
    return undefined
  }
  const length = lengthBytes.readUInt16BE(0)
  if (length < 2) {
    return undefined
  }
  if (marker !== 0xe1) {
    return { length }
  }
  const segment = await read({ length: length - 2, position: position + 2 })
  return { length, orientation: readExifOrientation({ segment }) }
}

const readJPEGMarkers = async ({ read }: { read: ReadJPEGBytes }): Promise<number | undefined> => {
  let position = 2

  for (let markerCount = 0; markerCount < 1024; markerCount++) {
    const marker = await read({ length: 2, position })
    if (marker.length !== 2 || marker[0] !== 0xff) {
      return undefined
    }
    if (marker[1] === 0xff) {
      position++
      continue
    }
    if (marker[1] === 0xda || marker[1] === 0xd9) {
      return undefined
    }
    position += 2
    if (isStandaloneMarker({ marker: marker[1]! })) {
      continue
    }

    const segment = await readSegment({ marker: marker[1]!, position, read })
    if (!segment) {
      return undefined
    }
    if (segment.orientation !== undefined) {
      return segment.orientation
    }
    position += segment.length
  }
  return undefined
}
