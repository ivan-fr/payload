import loadCustomRoutes from 'next/dist/lib/load-custom-routes.js'

import { afterEach, describe, expect, it } from 'vitest'

import { withPayload } from './withPayload.js'

const originalWarn = console.warn
const originalTrailingSlash = process.env.NEXT_TRAILING_SLASH
const originalBasePath = process.env.NEXT_BASE_PATH

afterEach(() => {
  console.warn = originalWarn
  if (originalTrailingSlash === undefined) delete process.env.NEXT_TRAILING_SLASH
  else process.env.NEXT_TRAILING_SLASH = originalTrailingSlash
  if (originalBasePath === undefined) delete process.env.NEXT_BASE_PATH
  else process.env.NEXT_BASE_PATH = originalBasePath
})

const hintKeys = ['Accept-CH', 'Vary', 'Critical-CH']

describe('scoped client-hint headers (#17906)', () => {
  it('should scope theme hints to the supplied admin route while preserving user headers and global Powered-By', async () => {
    const custom = {
      source: '/public/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=60' }],
    }
    const config = withPayload(
      { headers: async () => [custom] },
      { clientHintHeaders: '/cms/:path*' },
    )
    const headers = await config.headers()
    const hints = headers.filter((rule) =>
      rule.headers.some((header) => hintKeys.includes(header.key)),
    )

    expect(headers[0]).toBe(custom)
    expect(hints).toHaveLength(1)
    expect(hints[0]!.source).toBe('/cms/:path*')
    expect(hints[0]!.headers.map((header) => header.key)).toEqual(hintKeys)
    expect(headers.find((rule) => rule.source === '/:path*')!.headers).toEqual([
      { key: 'X-Powered-By', value: 'Next.js, Payload' },
    ])
  })

  it('should let Next.js apply basePath exactly once to the scoped header rule', async () => {
    const config = withPayload({ basePath: '/site' }, { clientHintHeaders: '/cms/:path*' })
    const routes = await loadCustomRoutes(config)
    const hints = routes.headers.filter((rule) =>
      rule.headers.some((header) => hintKeys.includes(header.key)),
    )

    expect(hints).toHaveLength(1)
    expect(hints[0]!.source).toBe('/site/cms/:path*')
    expect(
      routes.headers
        .find((rule) => rule.source === '/site/:path*')!
        .headers.map((header) => header.key),
    ).toEqual(['X-Powered-By'])
  })

  it('should allow hints to be disabled without removing Powered-By', async () => {
    const config = withPayload({}, { clientHintHeaders: false })
    const headers = await config.headers()

    expect(headers.flatMap((rule) => rule.headers.map((header) => header.key))).toEqual([
      'X-Powered-By',
    ])
  })

  it('should omit generated header rules when both hints and Powered-By are disabled', async () => {
    const config = withPayload({ poweredByHeader: false }, { clientHintHeaders: false })

    expect(await config.headers()).toEqual([])
  })

  it('should preserve existing defaults and avoid reintroducing disabled Powered-By', async () => {
    const defaults = withPayload({})
    const headers = await defaults.headers()

    expect(headers).toHaveLength(1)
    expect(headers[0]!.source).toBe('/:path*')
    expect(headers[0]!.headers.map((header) => header.key)).toEqual([...hintKeys, 'X-Powered-By'])
    const scoped = withPayload(
      { poweredByHeader: false, basePath: '/site' },
      { clientHintHeaders: '/cms/:path*' },
    )
    expect(await scoped.headers()).toEqual([
      { source: '/cms/:path*', headers: headers[0]!.headers.slice(0, 3) },
    ])
  })
})
