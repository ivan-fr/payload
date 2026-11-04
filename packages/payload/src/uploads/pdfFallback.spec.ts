import type { CollectionConfig, PayloadRequest } from '../index.js'

import fs from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn().mockResolvedValue(undefined),
  fileTypeFromFile: vi.fn().mockResolvedValue(undefined),
}))

import { checkFileRestrictions } from './checkFileRestrictions.js'
import { getFileTypeFallback } from './getFileTypeFallback.js'

const collection = { slug: 'media', upload: { mimeTypes: ['application/pdf'] } } as CollectionConfig
const req = { payload: { logger: { error: vi.fn(), warn: vi.fn() } } } as unknown as PayloadRequest

describe('PDF fallback without a detected MIME type (#16485)', () => {
  it.each(['report.pdf', 'REPORT.PDF'])('should identify %s as application/pdf', (name) => {
    expect(getFileTypeFallback(name)).toEqual({ ext: 'pdf', mime: 'application/pdf' })
  })

  it('should allow a valid PDF through extension fallback and integrity validation', async () => {
    const data = await fs.readFile(
      new URL('../../../../test/uploads/test-pdf.pdf', import.meta.url),
    )

    await expect(
      checkFileRestrictions({
        collection,
        req,
        file: { data, name: 'report.pdf', mimetype: 'application/pdf', size: data.length },
      }),
    ).resolves.toBeUndefined()
  })

  it('should still reject corrupt PDFs and unapproved extensions', async () => {
    await expect(
      checkFileRestrictions({
        collection,
        req,
        file: {
          data: Buffer.from('not a PDF'),
          name: 'report.pdf',
          mimetype: 'application/pdf',
          size: 9,
        },
      }),
    ).rejects.toMatchObject({
      data: { errors: [{ message: 'Invalid or corrupted PDF file.', path: 'file' }] },
    })
    await expect(
      checkFileRestrictions({
        collection,
        req,
        file: {
          data: Buffer.from('not a PDF'),
          name: 'report.txt',
          mimetype: 'application/pdf',
          size: 9,
        },
      }),
    ).rejects.toThrow()
  })
})
