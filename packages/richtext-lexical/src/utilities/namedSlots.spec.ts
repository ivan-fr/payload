import type { SerializedLexicalNode } from 'lexical'

import { describe, expect, it, vi } from 'vitest'

import { validateNodes } from '../validate/validateNodes.js'
import { recurseNodes, recurseNodesAsync } from './forEachNodeRecursively.js'
import { recurseNodeTree } from './recurseNodeTree.js'

const tree = () =>
  [
    {
      type: 'columns',
      version: 1,
      children: [{ type: 'text', version: 1 }],
      $slots: {
        left: {
          type: 'column',
          version: 1,
          children: [{ type: 'upload', version: 1, value: 854, relationTo: 'media', id: 'upload' }],
          $slots: {
            nested: { type: 'block', version: 1, fields: { id: 'nested-block' } },
          },
        },
        right: { type: 'relationship', version: 1, id: 'relationship' },
        absent: null,
        metadata: 'not a node',
        metadataObject: { label: 'not a node' },
      },
    },
  ] as unknown as SerializedLexicalNode[]

const types = ['columns', 'text', 'column', 'upload', 'block', 'relationship']

describe('Lexical named slot traversal (#19316)', () => {
  it('should visit ordinary children and nested named slot nodes for population', () => {
    const visited: string[] = []
    recurseNodes({ nodes: tree(), callback: (node) => visited.push(node.type) })
    expect(visited).toEqual(types)
  })

  it('should await every slot callback in traversal order', async () => {
    const visited: string[] = []
    await recurseNodesAsync({
      nodes: tree(),
      callback: async (node) => {
        await Promise.resolve()
        visited.push(node.type)
      },
    })
    expect(visited).toEqual(types)
  })

  it('should include slot nodes in flattened hooks and the node ID map', () => {
    const nodes = tree()
    const flattenedNodes: SerializedLexicalNode[] = []
    const nodeIDMap: Record<string, SerializedLexicalNode> = {}
    recurseNodeTree({ nodes, flattenedNodes, nodeIDMap })
    expect(flattenedNodes.map((node) => node.type)).toEqual(types)
    expect(nodeIDMap.upload).toMatchObject({ type: 'upload', value: 854 })
    expect(nodeIDMap['nested-block']).toMatchObject({ type: 'block' })
    expect(nodeIDMap.relationship).toMatchObject({ type: 'relationship' })
  })

  it('should reject an invalid node in a nested slot using its registered validator', async () => {
    const invalidUpload = vi.fn().mockResolvedValue('missing upload')
    const result = await validateNodes({
      nodes: tree(),
      nodeValidations: new Map([['upload', [invalidUpload]]]),
      validation: {} as never,
    })
    expect(invalidUpload).toHaveBeenCalledOnce()
    expect(result).toBe('upload node failed to validate: missing upload')
  })

  it('should still accept valid slots and ordinary children', async () => {
    const validate = vi.fn().mockResolvedValue(true)
    expect(
      await validateNodes({
        nodes: tree(),
        nodeValidations: new Map(types.map((type) => [type, [validate]])),
        validation: {} as never,
      }),
    ).toBe(true)
    expect(validate.mock.calls.map(([{ node }]) => node.type)).toEqual(types)
  })
})
