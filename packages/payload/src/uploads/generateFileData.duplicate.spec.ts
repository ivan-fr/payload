import type { Collection, PayloadRequest, SanitizedConfig } from '../index.js'

import { describe, expect, it, vi } from 'vitest'

import { generateFileData } from './generateFileData.js'

describe('fileless upload duplication overrides (#17762)', () => {
  it('should retain incoming business fields without mutating the source', async () => {
    const originalDoc = { owner: 'source', description: 'Keep' }
    const data = { owner: 'destination' }
    const collection = {
      config: {
        slug: 'media',
        upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
      },
    } as unknown as Collection
    const req = { payload: { config: {}, logger: { error: vi.fn() } } } as unknown as PayloadRequest

    const result = await generateFileData({
      collection,
      config: {} as SanitizedConfig,
      data,
      isDuplicating: true,
      operation: 'create',
      originalDoc,
      req,
      throwOnMissingFile: false,
    })

    expect(result.data.owner).toBe('destination')
    expect(originalDoc).toEqual({ owner: 'source', description: 'Keep' })
    expect(result.files).toEqual([])
  })
})
