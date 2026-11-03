import type { PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { getIncomingFiles } from '../utilities/getIncomingFiles.js'
import { getAfterChangeHook } from './afterChange.js'
import { getPreserveFileDataHook } from './preserveFileData.js'

describe('reusing caller upload context', () => {
  it.each([false, true])(
    'should isolate managed-upload metadata context (failure: %s)',
    async (shouldFail) => {
      const metadata = { url: 'https://storage.example.com/managed.txt' }
      const context = {
        marker: true,
        _payloadManagedCloudStorage: true,
        _payloadManagedCloudMetadata: metadata,
      }
      const query = { uploadEdits: { crop: true } }
      const failure = new Error('managed metadata failed')
      const handleUpload = vi.fn()
      const req = {
        context,
        query,
        payload: {
          update: vi.fn(async ({ req: nestedReq, id, data }) => {
            nestedReq.context = { ...nestedReq.context }
            expect(nestedReq.context.skipCloudStorage).toBe(true)
            expect(nestedReq.query).not.toHaveProperty('uploadEdits')
            if (shouldFail) throw failure
            return { id, ...data }
          }),
        },
      } as unknown as PayloadRequest
      const doc = { id: 1, filename: 'managed.txt', mimeType: 'text/plain' }
      const hook = getAfterChangeHook({
        collection: { slug: 'media' } as never,
        adapter: { handleUpload } as never,
      })
      const operation = hook({ data: doc, doc, operation: 'create', req } as never)

      if (shouldFail) await expect(operation).rejects.toBe(failure)
      else expect(await operation).toMatchObject(metadata)

      expect(req.context).toBe(context)
      expect(context).not.toHaveProperty('skipCloudStorage')
      expect(req.query).toBe(query)
      expect(query).toHaveProperty('uploadEdits')
      expect(handleUpload).not.toHaveBeenCalled()
    },
  )

  it.each([false, true])(
    'should restore the caller context after metadata persistence (failure: %s)',
    async (shouldFail) => {
      const sharedContext = { disableRevalidate: true }
      const error = new Error('metadata persistence failed')
      const handleUpload = vi.fn(async () => ({ url: 'https://storage.example.com/file.txt' }))
      const hook = getAfterChangeHook({
        collection: { slug: 'media' } as never,
        adapter: { handleUpload } as never,
      })

      for (const name of ['a.txt', 'b.txt']) {
        const req = {
          context: sharedContext,
          file: { data: Buffer.from(name), size: name.length },
          payload: {
            logger: { error: vi.fn() },
            update: vi.fn(async ({ req: nestedReq, id, data }) => {
              // Nested Local API calls replace req.context with a shallow copy.
              nestedReq.context = { ...nestedReq.context }
              expect(nestedReq.context.skipCloudStorage).toBe(true)
              if (shouldFail) throw error
              return { id, ...data }
            }),
          },
        } as unknown as PayloadRequest
        const doc = { id: name, filename: name, mimeType: 'text/plain' }
        const operation = hook({ data: doc, doc, operation: 'create', req } as never)

        if (shouldFail) await expect(operation).rejects.toBe(error)
        else await operation

        expect(req.context).toBe(sharedContext)
        expect(sharedContext).toEqual({ disableRevalidate: true })
      }

      expect(handleUpload.mock.calls.map(([{ file }]) => file.buffer?.toString())).toEqual([
        'a.txt',
        'b.txt',
      ])
    },
  )

  it('should preserve the current operation file without retaining buffers on the caller context', async () => {
    const firstFile = { data: Buffer.from('first'), size: 5 }
    const sharedContext = {
      marker: true,
      _payloadCloudStorage: {
        file: firstFile,
        uploadSizes: { thumbnail: Buffer.from('old thumbnail') },
      },
    }
    const req = {
      context: sharedContext,
      file: { data: Buffer.from('second'), size: 6 },
    } as unknown as PayloadRequest

    await getPreserveFileDataHook()({ req } as never)
    req.file = undefined
    const files = getIncomingFiles({
      req,
      data: { filename: 'second.txt', mimeType: 'text/plain' },
    })

    expect(files[0]?.buffer?.toString()).toBe('second')
    expect(req.context).not.toBe(sharedContext)
    expect(sharedContext._payloadCloudStorage.file).toBe(firstFile)
  })
})
