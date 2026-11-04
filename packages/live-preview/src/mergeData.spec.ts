import { afterEach, describe, expect, it, vi } from 'vitest'

import { handleMessage, resetCache } from './handleMessage.js'
import { mergeData } from './mergeData.js'
import { subscribe } from './subscribe.js'

afterEach(() => {
  resetCache()
  vi.unstubAllGlobals()
})

describe('live preview population target (#17938)', () => {
  it.each([42, 'page-slug', 0])(
    'should populate incoming document %s when initialData has no ID',
    async (id) => {
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ id, title: 'Populated' }))
      const callback = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const handler = subscribe({ serverURL: 'https://cms.example', initialData: {}, callback })

      await handler(
        new MessageEvent('message', {
          origin: 'https://cms.example',
          data: {
            type: 'payload-live-preview',
            collectionSlug: 'pages',
            data: { id, title: 'Edited' },
          },
        }),
      )

      expect(fetchMock.mock.calls[0][0]).toBe(`https://cms.example/api/pages/${id}`)
      expect(callback).toHaveBeenCalledWith({ id, title: 'Populated' })
    },
  )

  it('should preserve the initial document target when incoming data omits ID', async () => {
    const requestHandler = vi.fn().mockResolvedValue(Response.json({ id: 'known' }))

    await mergeData({
      serverURL: 'https://cms.example',
      collectionSlug: 'pages',
      incomingData: { title: 'Edit' },
      initialData: { id: 'known' },
      requestHandler,
    })
    expect(requestHandler.mock.calls[0][0].endpoint).toBe('pages/known')
  })

  it('should reject REST errors without invoking the subscriber callback or poisoning the cache', async () => {
    const callback = vi.fn()
    const requestHandler = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ id: 42, title: 'Recovered' }))
    const initialData = { id: 42, title: 'Original' }
    const event = new MessageEvent('message', {
      origin: 'https://cms.example',
      data: { type: 'payload-live-preview', collectionSlug: 'pages', data: { id: 42 } },
    })
    const handler = subscribe({
      callback,
      initialData,
      requestHandler,
      serverURL: 'https://cms.example',
    })

    await expect(handler(event)).rejects.toThrow('403')
    expect(callback).not.toHaveBeenCalled()
    const unrelated = new MessageEvent('message', { origin: 'https://other.example' })
    expect(
      await handleMessage({ event: unrelated, initialData, serverURL: 'https://cms.example' }),
    ).toEqual(initialData)
    await handler(event)
    expect(callback).toHaveBeenCalledWith({ id: 42, title: 'Recovered' })
  })

  it('should reject an ID-less collection message before sending a request', async () => {
    const requestHandler = vi.fn()

    await expect(
      mergeData({
        serverURL: 'https://cms.example',
        collectionSlug: 'pages',
        incomingData: {},
        initialData: {},
        requestHandler,
      }),
    ).rejects.toThrow('document ID')
    expect(requestHandler).not.toHaveBeenCalled()
  })

  it('should keep globals independent of document IDs', async () => {
    const requestHandler = vi.fn().mockResolvedValue(Response.json({ title: 'Settings' }))

    await mergeData({
      serverURL: 'https://cms.example',
      globalSlug: 'settings',
      incomingData: {},
      initialData: {},
      requestHandler,
    })
    expect(requestHandler.mock.calls[0][0].endpoint).toBe('globals/settings')
  })
})
