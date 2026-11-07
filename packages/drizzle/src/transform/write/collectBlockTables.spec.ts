import type { FlattenedBlock } from 'payload'

import { expect, it } from 'vitest'

import { setInternalBlockIndex } from '../../utilities/validateExistingBlockIsIdentical.js'
import { collectBlockTables } from './collectBlockTables.js'

it('should traverse absent nested blocks through arrays and groups, references and recursive definitions (#19322)', () => {
  const leaf = { slug: 'leaf', fields: [], flattenedFields: [] } as unknown as FlattenedBlock
  const root = {
    slug: 'root',
    fields: [],
    flattenedFields: [
      {
        name: 'rows',
        type: 'array',
        flattenedFields: [
          {
            name: 'group',
            type: 'group',
            flattenedFields: [{ name: 'children', type: 'blocks', blocks: ['leaf', 'root'] }],
          },
        ],
      },
    ],
  } as unknown as FlattenedBlock
  setInternalBlockIndex(leaf, 2)
  const blocksToDelete = new Set<string>()
  collectBlockTables({
    adapter: {
      payload: { blocks: { leaf, root }, config: { blocks: [leaf, root] } },
      tableNameMap: new Map([
        ['pages_blocks_leaf', 'custom_leaf'],
        ['pages_blocks_root', 'pages_blocks_root'],
      ]),
    } as never,
    baseTableName: 'pages',
    blocksToDelete,
    fields: [{ name: 'content', type: 'blocks', blocks: [root] }] as never,
  })

  expect([...blocksToDelete]).toEqual(['pages_blocks_root', 'custom_leaf_2'])
})
