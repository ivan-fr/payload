import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { detectFileTypeFromFile } from './detectFileTypeFromFile.js'
import { getFileByPath } from './getFileByPath.js'

let directory: string
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'payload-type-'))
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})
it('should detect actual file contents and close its tokenizer handle', async () => {
  const filename = path.join(directory, 'image.dat')
  const data = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c2Z8AAAAASUVORK5CYII=',
    'base64',
  )
  await fs.writeFile(filename, data)
  const open = fs.open.bind(fs)
  const handles: Awaited<ReturnType<typeof fs.open>>[] = []
  vi.spyOn(fs, 'open').mockImplementation(async (...args: Parameters<typeof fs.open>) => {
    const handle = await open(...args)
    handles.push(handle)
    return handle
  })
  expect(await detectFileTypeFromFile({ path: filename })).toEqual({
    ext: 'png',
    mime: 'image/png',
  })
  expect(handles).toHaveLength(1)
  await expect(handles[0]!.stat()).rejects.toMatchObject({ code: 'EBADF' })
  const result = await getFileByPath(filename)
  expect(result).toMatchObject({ name: 'image.dat', mimetype: 'image/png', size: data.length })
  expect(result!.data).toEqual(data)
})
it('should reject non-regular filesystem objects without retaining a handle', async () => {
  await expect(detectFileTypeFromFile({ path: directory })).resolves.toBeUndefined()
})
it('should preserve missing-file errors and return no MIME type for an empty file', async () => {
  await expect(
    detectFileTypeFromFile({ path: path.join(directory, 'missing') }),
  ).rejects.toMatchObject({ code: 'ENOENT' })
  const filename = path.join(directory, 'empty')
  await fs.writeFile(filename, '')
  await expect(detectFileTypeFromFile({ path: filename })).resolves.toBeUndefined()
})
