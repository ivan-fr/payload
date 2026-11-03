import type { PayloadRequest, SanitizedGlobalConfig } from 'payload'

import { updateOperationGlobal } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { update } from './update.js'

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  updateOperationGlobal: vi.fn().mockResolvedValue({}),
}))

describe('GraphQL global update resolver', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should supply empty data when the mutation has no exposed input fields', async () => {
    const config = { slug: 'settings' } as SanitizedGlobalConfig
    const req = { context: {} } as PayloadRequest

    await update(config)(undefined, {}, { req })

    expect(updateOperationGlobal).toHaveBeenCalledWith(expect.objectContaining({ data: {} }))
    expect(req.context).toEqual({})
  })

  it('should preserve supplied mutation data', async () => {
    const config = { slug: 'settings' } as SanitizedGlobalConfig
    const data = { title: 'Updated' }
    const req = { context: {} } as PayloadRequest

    await update(config)(undefined, { data }, { req })

    expect(updateOperationGlobal).toHaveBeenCalledWith(expect.objectContaining({ data }))
  })
})
