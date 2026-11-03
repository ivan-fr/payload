import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatAdminURL } from '../utilities/formatAdminURL.js'
import { generateFilePathOrURL } from './generateFilePathOrURL.js'
import { generatePayloadFileURL } from './generatePayloadFileURL.js'

describe('file URLs with Next trailing slashes', () => {
  const config = { routes: { api: '/api' }, serverURL: 'https://example.com' }

  afterEach(() => vi.unstubAllEnvs())

  it.each([true, false])('should retain the object filename (relative: %s)', (relative) => {
    vi.stubEnv('NEXT_TRAILING_SLASH', 'true')
    vi.stubEnv('NEXT_BASE_PATH', '/cms')

    expect(
      generateFilePathOrURL({
        collectionSlug: 'media',
        config,
        filename: 'my file.png',
        relative,
        urlOrPath: undefined,
      }),
    ).toBe(`${relative ? '' : config.serverURL}/cms/api/media/file/my%20file.png`)
    expect(formatAdminURL({ apiRoute: '/api', path: '/media', relative: true })).toBe(
      '/cms/api/media/',
    )
  })

  it('should append transformer and prefix queries directly after the filename', () => {
    vi.stubEnv('NEXT_TRAILING_SLASH', 'true')
    vi.stubEnv('NEXT_BASE_PATH', '')

    expect(
      generatePayloadFileURL({
        collectionSlug: 'media',
        config: config as never,
        filename: 'image.png',
        prefix: 'tenant/a',
        query: { original: true },
        relative: true,
      }),
    ).toBe('/api/media/file/image.png?prefix=tenant%2Fa&original=true')
  })

  it('should leave external URLs unchanged', () => {
    vi.stubEnv('NEXT_TRAILING_SLASH', 'true')

    expect(
      generateFilePathOrURL({
        collectionSlug: 'media',
        config,
        filename: 'image.png',
        relative: true,
        urlOrPath: 'https://cdn.example.com/custom.png?x=1',
      }),
    ).toBe('https://cdn.example.com/custom.png?x=1')
  })
})
