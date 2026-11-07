import { afterEach, expect, it, vi } from 'vitest'

import { handleMessage } from './handleMessage.js'
import { subscribe } from './subscribe.js'

vi.mock('./handleMessage.js', () => ({
  handleMessage: vi.fn().mockResolvedValue({ title: 'Updated' }),
  resetCache: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

it('should discard messages from an untrusted origin before handling data or calling back', async () => {
  const callback = vi.fn()
  const listener = subscribe({
    callback,
    initialData: { title: 'Initial' },
    serverURL: 'https://cms.example.com',
  })

  await listener({ origin: 'https://attacker.example.com', data: {} } as MessageEvent)

  expect(handleMessage).not.toHaveBeenCalled()
  expect(callback).not.toHaveBeenCalled()
})

it('should still handle messages from the configured server origin', async () => {
  const callback = vi.fn()
  const listener = subscribe({
    callback,
    initialData: { title: 'Initial' },
    serverURL: 'https://cms.example.com',
  })

  await listener({ origin: 'https://cms.example.com', data: {} } as MessageEvent)

  expect(handleMessage).toHaveBeenCalledOnce()
  expect(callback).toHaveBeenCalledWith({ title: 'Updated' })
})
