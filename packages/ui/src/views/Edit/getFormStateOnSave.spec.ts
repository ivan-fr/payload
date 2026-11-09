import { describe, expect, it, vi } from 'vitest'

import { getFormStateOnSave } from './getFormStateOnSave.js'

describe('save form-state cancellation (#17779)', () => {
  it('should ignore an aborted empty response rather than clearing the preview', async () => {
    const controller = new AbortController()
    let resolve!: (value: { state: null }) => void
    const response = new Promise<{ state: null }>((done) => {
      resolve = done
    })
    const result = getFormStateOnSave({
      args: { signal: controller.signal } as never,
      getFormState: () => response,
    })
    controller.abort()
    resolve({ state: null })
    expect(await result).toBeUndefined()
  })
  it('should preserve a current response, including an intentional empty preview URL', async () => {
    const response = { state: null, livePreviewURL: undefined }
    const getFormState = vi.fn(async () => response)
    expect(await getFormStateOnSave({ args: {} as never, getFormState })).toBe(response)
    expect(getFormState).toHaveBeenCalledOnce()
  })
  it('should propagate failures of the active request', async () => {
    const error = new Error('server unavailable')
    await expect(
      getFormStateOnSave({ args: {} as never, getFormState: () => Promise.reject(error) }),
    ).rejects.toBe(error)
  })
})
