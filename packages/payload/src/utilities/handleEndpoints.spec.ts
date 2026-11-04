import { describe, expect, it, vi } from 'vitest'

import type { Endpoint, SanitizedConfig } from '../config/types.js'
import type { PayloadRequest } from '../types/index.js'

vi.mock('./createPayloadRequestFromWebRequest.js', () => ({
  createPayloadRequestFromWebRequest: vi.fn(),
}))

import { createPayloadRequestFromWebRequest } from './createPayloadRequestFromWebRequest.js'
import { handleEndpoints } from './handleEndpoints.js'

describe('HEAD response streams (#16754)', () => {
  it('should cancel a fallback stream while preserving status, headers and request method', async () => {
    const cancel = vi.fn()
    const handler = vi.fn((req: PayloadRequest) => {
      expect(req.method).toBe('HEAD')
      return new Response(new ReadableStream({ cancel }), {
        status: 206,
        statusText: 'Partial Content',
        headers: { 'Content-Length': '20', 'X-Custom': 'metadata' },
      })
    })
    const config = {
      routes: { api: '/api' },
      cors: false,
      endpoints: [{ path: '/stream', method: 'get', handler }] as Endpoint[],
    } as SanitizedConfig
    vi.mocked(createPayloadRequestFromWebRequest).mockResolvedValue({
      method: 'HEAD',
      url: 'http://localhost/api/stream',
      headers: new Headers(),
      payload: { config, collections: {}, globals: { config: [] } },
    } as unknown as PayloadRequest)
    const response = await handleEndpoints({
      config,
      request: new Request('http://localhost/api/stream', { method: 'HEAD' }),
    })
    expect(cancel).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledOnce()
    expect(response.status).toBe(206)
    expect(response.statusText).toBe('Partial Content')
    expect(response.headers.get('content-length')).toBe('20')
    expect(response.headers.get('x-custom')).toBe('metadata')
    expect(response.body).toBeNull()
  })

  it('should capture the method before a handler consumes a lazy framework request', async () => {
    let hasConsumedBody = false
    const request = new Request('http://localhost/api/write', { method: 'POST' })
    Object.defineProperty(request, 'method', {
      get: () => {
        if (hasConsumedBody) throw new TypeError('Cannot reconstruct a consumed request')
        return 'POST'
      },
    })
    const handler = vi.fn(() => {
      hasConsumedBody = true
      return new Response('POST result')
    })
    const config = {
      routes: { api: '/api' },
      cors: false,
      endpoints: [{ path: '/write', method: 'post', handler }] as Endpoint[],
    } as SanitizedConfig
    vi.mocked(createPayloadRequestFromWebRequest).mockResolvedValue({
      method: 'POST',
      url: 'http://localhost/api/write',
      headers: new Headers(),
      payload: { config, collections: {}, globals: { config: [] } },
    } as unknown as PayloadRequest)
    const response = await handleEndpoints({ config, request })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('POST result')
    expect(handler).toHaveBeenCalledOnce()
  })
})
