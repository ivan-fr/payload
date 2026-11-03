import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTsconfig } from 'get-tsconfig'

import { findUpSync } from '../utilities/findUp.js'
import { findConfig } from './find.js'

vi.mock('get-tsconfig', () => ({ getTsconfig: vi.fn() }))
vi.mock('../utilities/findUp.js', () => ({ findUpSync: vi.fn() }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe('tsconfig-relative paths (#18324)', () => {
  it.each([
    { environment: 'development', key: 'rootDir', directory: './' },
    { environment: 'production', key: 'outDir', directory: './build' },
  ])('should resolve $key against the tsconfig directory', ({ environment, key, directory }) => {
    vi.stubEnv('NODE_ENV', environment)
    vi.stubEnv('PAYLOAD_CONFIG_PATH', '')
    const configDir = path.resolve('/tmp/payload-config-project')
    const expectedDir = path.resolve(configDir, directory)
    const expectedConfig = path.join(expectedDir, 'payload.config.ts')
    vi.mocked(getTsconfig).mockReturnValue({
      path: path.join(configDir, 'tsconfig.json'),
      config: { compilerOptions: { baseUrl: './aliases', [key]: directory } },
    })
    vi.mocked(findUpSync).mockImplementation(({ dir }) =>
      dir === expectedDir ? expectedConfig : null,
    )

    expect(findConfig()).toBe(expectedConfig)
    expect(findUpSync).toHaveBeenCalledWith(expect.objectContaining({ dir: expectedDir }))
  })
})
