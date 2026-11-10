import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  readFileSync: vi.fn(),
}))

const originalWarn = console.warn
let warn = vi.fn()
let version = '16.4.2'
let range = '>=16.4.0 <17.0.0'

beforeEach(() => {
  vi.resetModules()
  version = '16.4.2'
  range = '>=16.4.0 <17.0.0'
  vi.mocked(readFileSync).mockImplementation((file) => {
    return JSON.stringify(
      file instanceof URL || String(file).endsWith('/packages/next/package.json')
        ? { peerDependencies: { next: range } }
        : { version },
    )
  })
  warn = vi.fn()
  console.warn = warn
})

afterEach(() => {
  console.warn = originalWarn
  vi.restoreAllMocks()
})

describe('Next.js peer range warning (#17119)', () => {
  it.each(['16.2.1', '16.3.9', '17.0.0', '16.5.0-canary.1'])(
    'should warn once when withPayload loads unsupported Next.js %s',
    async (unsupportedVersion) => {
      version = unsupportedVersion
      const { withPayload } = await import('./withPayload.js')

      expect(withPayload({ basePath: '/cms' }).basePath).toBe('/cms')
      withPayload()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`installed Next.js ${version}`))
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(range))
    },
  )

  it.each(['16.4.0', '16.4.2', '16.4.2+build.1'])(
    'should leave compatible Next.js %s quiet',
    async (supportedVersion) => {
      version = supportedVersion
      const { withPayload } = await import('./withPayload.js')

      withPayload()
      expect(warn).not.toHaveBeenCalled()
    },
  )

  it('should read the package peer range rather than hardcoding the current minimum', async () => {
    range = '>=15.4.11 <15.5.0 || >=16.4.0 <17.0.0'
    version = '15.4.11'
    const { withPayload } = await import('./withPayload.js')

    withPayload()
    expect(warn).not.toHaveBeenCalled()
    version = '15.5.0'
    withPayload()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('should preserve config loading if version discovery fails', async () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('Unavailable metadata')
    })
    const { withPayload } = await import('./withPayload.js')

    expect(withPayload({ basePath: '/cms' }).basePath).toBe('/cms')
    expect(warn).not.toHaveBeenCalled()
  })

  it('should ignore unparseable installed versions', async () => {
    version = 'custom'
    const { withPayload } = await import('./withPayload.js')

    withPayload()
    expect(warn).not.toHaveBeenCalled()
  })
})
