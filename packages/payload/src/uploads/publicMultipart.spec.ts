import { describe, expect, it } from 'vitest'

import { processMultipartFormdata } from '../index.js'

const createRequest = async () => {
  const body = new FormData()

  body.set('title', 'Two files')
  body.set('front', new Blob(['front'], { type: 'text/plain' }), 'front.txt')
  body.set('back', new Blob(['back'], { type: 'text/plain' }), 'back.txt')
  const response = new Response(body)

  return new Request('https://cms.example/api/inspect-uploads', {
    method: 'POST',
    body: await response.arrayBuffer(),
    headers: { 'content-type': response.headers.get('content-type')! },
  })
}

describe('public multipart parser (#10125)', () => {
  it('should expose parsing of separately named files and text fields through the public entry point', async () => {
    const { error, fields, files } = await processMultipartFormdata({
      request: await createRequest(),
    })

    expect(error).toBeUndefined()
    expect(fields.title).toBe('Two files')
    expect(Object.keys(files)).toEqual(['front', 'back'])
    expect(files.front).toMatchObject({ name: 'front.txt', mimetype: 'text/plain', size: 5 })
    expect(files.front!.data.toString()).toBe('front')
    expect(files.back!.data.toString()).toBe('back')
  })

  it('should retain supplied upload limits for custom endpoint consumers', async () => {
    await expect(
      processMultipartFormdata({
        request: await createRequest(),
        options: { limits: { files: 1 } },
      }),
    ).rejects.toMatchObject({ status: 413 })
  })
})
