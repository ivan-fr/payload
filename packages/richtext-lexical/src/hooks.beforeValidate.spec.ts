import { describe, expect, it, vi } from 'vitest'

import { getLexicalHooks } from './hooks.js'

describe('nested Lexical beforeValidate hooks (#17950)', () => {
  it.each(
    ['block', 'link', 'upload'].flatMap((type) =>
      ['create', 'update', 'validate'].map((operation) => ({ type, operation })),
    ),
  )(
    'should run a nested field hook without node hooks for $type during $operation',
    async ({ type, operation }) => {
      const hook = vi.fn(async ({ value }) => `${value}-normalized`)
      const node = { id: 'node-1', type, version: 1, fields: { id: 'node-1', title: 'input' } }
      const value = { root: { type: 'root', children: [node] } }
      const hooks = getLexicalHooks({
        editorConfig: {
          features: {
            hooks: {},
            getSubFields: new Map([
              [type, () => [{ name: 'title', type: 'text', hooks: { beforeValidate: [hook] } }]],
            ]),
            getSubFieldsData: new Map([[type, ({ node }) => node?.fields]]),
          },
        } as never,
      })

      const result = await hooks.beforeValidate![0]!({
        collection: null,
        global: null,
        context: {},
        data: { content: value },
        originalDoc: {},
        field: { name: 'content', type: 'richText' },
        indexPath: [0],
        path: ['content'],
        schemaPath: ['content'],
        operation,
        overrideAccess: true,
        parentIsLocalized: false,
        previousValue: undefined,
        req: { context: {}, payload: { config: { localization: false } }, t: (key: string) => key },
        value,
      } as never)

      expect(hook).toHaveBeenCalledOnce()
      expect(node.fields.title).toBe('input-normalized')
      expect(result).toBe(value)
    },
  )
})
