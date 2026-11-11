import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { transformSync } = require('esbuild')
const { nodeFileTrace } = require('next/dist/compiled/@vercel/nft/index.js')

it('should trace the Node file tokenizer required by standalone uploads (#18588)', async () => {
  const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
  const directory = await fs.mkdtemp(path.join(packageRoot, '.file-type-trace-'))
  try {
    const entry = path.join(directory, 'getFileByPath.js')
    const source = await fs.readFile(new URL('./getFileByPath.ts', import.meta.url), 'utf8')
    await fs.writeFile(entry, transformSync(source, { loader: 'ts', format: 'esm' }).code)
    try {
      const helper = await fs.readFile(
        new URL('./detectFileTypeFromFile.ts', import.meta.url),
        'utf8',
      )
      await fs.writeFile(
        path.join(directory, 'detectFileTypeFromFile.js'),
        transformSync(helper, { loader: 'ts', format: 'esm' }).code,
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const { fileList } = await nodeFileTrace([entry], {
      base: process.cwd(),
      processCwd: process.cwd(),
    })
    const files = ([...fileList] as string[]).map((file) => file.replaceAll('\\', '/'))
    expect(files.some((file) => file.endsWith('/strtok3/lib/index.js'))).toBe(true)
    expect(files.some((file) => file.endsWith('/strtok3/lib/FileTokenizer.js'))).toBe(true)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
