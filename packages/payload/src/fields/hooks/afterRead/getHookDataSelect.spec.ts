import type { FlattenedBlock, FlattenedField } from '../../config/types.js'

import { describe, expect, it } from 'vitest'

import { getHookDataSelect } from './getHookDataSelect.js'

describe('hook projection with recursive block definitions', () => {
  it('should terminate when a block references its own schema', () => {
    const block = { slug: 'recursive', flattenedFields: [] as FlattenedField[] } as FlattenedBlock
    const field = { name: 'layout', type: 'blocks', blocks: [block] } as FlattenedField
    block.flattenedFields.push(field)

    expect(() =>
      getHookDataSelect({ blocks: {}, fields: [field], targetPath: ['fullName'] }),
    ).not.toThrow()
  })
})
