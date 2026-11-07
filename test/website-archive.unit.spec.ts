import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

it('should render only publicly readable posts in the website archive (#15633)', async () => {
  const published = { id: 1, title: 'Published', _status: 'published' }
  const unpublished = { id: 2, title: 'Unpublished', _status: 'draft' }
  const find = vi.fn(({ overrideAccess }: { overrideAccess: boolean }) =>
    Promise.resolve({
      docs: overrideAccess ? [published, unpublished] : [published],
    }),
  )
  const source = fs.readFileSync(
    new URL('../templates/website/src/blocks/ArchiveBlock/Component.tsx', import.meta.url),
    'utf8',
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const actualRequire = createRequire(import.meta.url)
  const mod = {
    exports: {} as {
      ArchiveBlock: (props: object) => Promise<{
        props: { children: [unknown, { props: { posts: unknown[] } }] }
      }>
    },
  }
  const dependencies: Record<string, unknown> = {
    '@payload-config': { default: {} },
    payload: { getPayload: () => Promise.resolve({ find }) },
    '@/components/RichText': { default: () => null },
    '@/components/CollectionArchive': { CollectionArchive: () => null },
  }
  vm.runInNewContext(compiled, {
    module: mod,
    exports: mod.exports,
    require: (name: string) => dependencies[name] ?? actualRequire(name),
  })

  const result = await mod.exports.ArchiveBlock({
    populateBy: 'collection',
    categories: [{ id: 9 }],
    limit: 2,
  })

  expect(result.props.children[1].props.posts).toEqual([published])
  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({
      overrideAccess: false,
      limit: 2,
      where: { categories: { in: [9] } },
    }),
  )
})
