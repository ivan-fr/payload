import { describe, expect, it, vi } from 'vitest'

import { getAfterChangeHook } from './afterChange.js'

describe('renamed upload responses (#18384)', () => {
  it.each(['create', 'update'])('should return refreshed file URLs after %s', async (operation) => {
    const original = {
      id: 1,
      filename: 'photo.jpg',
      url: 'https://files.test/photo.jpg',
      mimeType: 'image/jpeg',
    }
    const persisted = {
      ...original,
      filename: 'photo-random.jpg',
      url: 'https://files.test/photo-random.jpg',
    }
    const update = vi.fn(async () => persisted)
    const hook = getAfterChangeHook({
      adapter: {
        handleUpload: vi.fn(async () => ({ ...original, filename: persisted.filename })),
        handleDelete: vi.fn(),
      } as never,
      collection: { slug: 'media' } as never,
      disablePayloadAccessControl: true,
    })
    const req = {
      context: {},
      file: { data: Buffer.from('file'), size: 4 },
      payload: { update, logger: { error: vi.fn() } },
    }

    const result = await hook({ data: original, doc: original, operation, req } as never)

    expect(result).toMatchObject(persisted)
    expect(update).toHaveBeenCalledOnce()
    expect(req.context).toEqual({})
  })
})

describe('upload replacement cleanup', () => {
  it.each([
    ['invoices', 'media/invoices', true, false],
    ['invoices', 'media/invoices', true, true],
    ['', 'media', false, false],
    ['media/invoices', 'media/invoices', false, false],
  ] as const)(
    'should compare object locations when replacing %s with %s (delete: %s, selected: %s)',
    async (oldPrefix, newPrefix, shouldDelete, isSelected) => {
      const handleDelete = vi.fn()
      const hook = getAfterChangeHook({
        adapter: { handleUpload: vi.fn(), handleDelete } as never,
        collection: { slug: 'media' } as never,
        collectionPrefix: 'media',
      })

      const uploadData = {
        id: 1,
        filename: 'file.png',
        mimeType: 'image/png',
        variants: { thumbnail: { filename: 'thumb.png' } },
        prefix: newPrefix,
      }

      await hook({
        data: uploadData,
        doc: isSelected ? { id: 1 } : uploadData,
        select: isSelected ? {} : undefined,
        previousDoc: {
          id: 1,
          filename: 'file.png',
          mimeType: 'image/png',
          variants: { thumbnail: { filename: 'thumb.png' } },
          prefix: oldPrefix,
        },
        operation: 'update',
        req: {
          context: {},
          file: { data: Buffer.from('file'), size: 4 },
          payload: { logger: { error: vi.fn() } },
        },
      } as never)

      expect(handleDelete).toHaveBeenCalledTimes(shouldDelete ? 2 : 0)
      if (shouldDelete) {
        expect(handleDelete).toHaveBeenCalledWith(
          expect.objectContaining({
            doc: expect.objectContaining({ prefix: oldPrefix }),
            filename: 'file.png',
          }),
        )
      }
    },
  )
})
