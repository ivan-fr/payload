import type { PayloadRequest } from '../types/index.js'

import { describe, expect, it, vi } from 'vitest'

import { createFileRequest } from './createFileRequest.js'
import {
  beginFileOperationScope,
  completeFileOperationScope,
  rollbackFileOperations,
  runFileCreationPlan,
  shareFileOperationScope,
} from './fileVersioning/fileOperationManager.js'

describe('Local API file request scope', () => {
  it.each([false, true])(
    'should compensate nested files when the shared transaction rolls back (outer proxy: %s)',
    async (hasOuterProxy) => {
      const owner = {
        transactionID: 'outer',
        payload: { logger: { error: vi.fn() } },
      } as unknown as PayloadRequest
      const operation = hasOuterProxy ? createFileRequest({ req: owner }) : owner
      if (hasOuterProxy) shareFileOperationScope({ owner, req: operation })
      beginFileOperationScope({ req: operation })
      const req = createFileRequest({ req: operation })
      const remove = vi.fn().mockResolvedValue(undefined)
      await runFileCreationPlan({
        req,
        stage: async ({ trackStagedObject }) => {
          trackStagedObject({ key: 'nested.png', remove })
        },
        write: async () => ({ id: 1 }),
      })
      expect(remove).not.toHaveBeenCalled()
      await rollbackFileOperations({ req: owner })
      expect(remove).toHaveBeenCalledOnce()
    },
  )

  it('should retain committed nested files', async () => {
    const owner = {
      transactionID: 'outer',
      payload: { logger: { error: vi.fn() } },
    } as unknown as PayloadRequest
    beginFileOperationScope({ req: owner })
    const req = createFileRequest({ req: owner })
    const remove = vi.fn().mockResolvedValue(undefined)
    await runFileCreationPlan({
      req,
      stage: async ({ trackStagedObject }) => {
        trackStagedObject({ key: 'nested.png', remove })
      },
      write: async () => ({ id: 1 }),
    })
    delete owner.transactionID
    await completeFileOperationScope({ req: owner })
    expect(remove).not.toHaveBeenCalled()
  })
})
