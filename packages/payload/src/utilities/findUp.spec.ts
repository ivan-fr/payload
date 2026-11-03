import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import { findUp, findUpSync } from './findUp.js'

const directories: string[] = []

function createDirectory() {
  const dir = mkdtempSync(path.join(tmpdir(), 'payload-find-up-'))
  directories.push(dir)
  return dir
}

afterEach(() =>
  directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })),
)

describe('relative config discovery (#18324)', () => {
  it.each(['findUpSync', 'findUp'])(
    'should terminate %s when a relative directory has no match',
    (name) => {
      const dir = createDirectory()
      const source = fileURLToPath(new URL('./findUp.ts', import.meta.url))
      // Run the potentially infinite loop in a bounded subprocess, never in the test worker.
      const script = `import { ${name} } from ${JSON.stringify(source)};
      console.log(JSON.stringify(await ${name}({dir: './', fileNames: ['missing-payload-config-18324.ts']})));`
      const result = spawnSync(
        process.execPath,
        ['--experimental-strip-types', '--input-type=module', '-e', script],
        {
          cwd: dir,
          encoding: 'utf8',
          timeout: 3000,
        },
      )

      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout.trim()).toBe('null')
    },
  )

  it.each([findUpSync, findUp])(
    'should find a parent config from a relative directory',
    async (find) => {
      const dir = createDirectory()
      const child = path.join(dir, 'nested')
      mkdirSync(child)
      const config = path.join(dir, 'payload.config.ts')
      writeFileSync(config, 'export default {}')

      expect(
        await find({ dir: path.relative(process.cwd(), child), fileNames: ['payload.config.ts'] }),
      ).toBe(config)
    },
  )
})
