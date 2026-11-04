import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'

import { runTransforms } from '../../runner.js'
import { addOverrideAccessTrue } from './index.js'

const fixtureDirectory = dirname(fileURLToPath(import.meta.url))

const apply = async (source: string) => {
  const project = new Project({ useInMemoryFileSystem: true })
  const file = project.createSourceFile('/project/input.ts', source)
  const result = await runTransforms({ project, transforms: [addOverrideAccessTrue] })

  return { file, result: result.results[0]! }
}

describe('manual review of skipped access migration calls (#18874)', () => {
  it('should leave skipped calls intact and report each ambiguous Payload call with file, original line and callee', async () => {
    const input = await readFile(join(fixtureDirectory, 'skipped.input.ts'), 'utf8')
    const output = await readFile(join(fixtureDirectory, 'skipped.output.ts'), 'utf8')
    const { file, result } = await apply(input)

    expect(file.getFullText()).toBe(output)
    expect(result.filesChanged).toEqual([])
    expect(result.notes).toHaveLength(3)
    expect(result.notes![0]).toMatch(/\/project\/input.ts:2:.*payload.find.*spread/i)
    expect(result.notes![1]).toMatch(/\/project\/input.ts:3:.*req.payload.update.*literal/i)
    expect(result.notes![2]).toMatch(/\/project\/input.ts:4:.*payload.jobs.queue.*literal/i)
    const second = await apply(file.getFullText())
    expect(second.file.getFullText()).toBe(output)
    expect(second.result.notes).toEqual(result.notes)
  })

  it('should report the original line even if another call is migrated in the same file', async () => {
    const { result, file } = await apply(
      "await payload.find({ collection: 'posts' })\nawait payload.find(args)",
    )

    expect(result.filesChanged).toEqual(['/project/input.ts'])
    expect(file.getFullText()).toContain('overrideAccess: true')
    expect(result.notes).toHaveLength(1)
    expect(result.notes![0]).toContain('/project/input.ts:2:')
  })

  it('should not flag explicit decisions or unrelated receivers', async () => {
    const { result } = await apply(
      'await service.find(args)\nawait payload.find({ ...args, overrideAccess: false })',
    )

    expect(result.filesChanged).toEqual([])
    expect(result.notes ?? []).toEqual([])
  })
})
