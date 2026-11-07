import type { FlattenedBlock, FlattenedField } from 'payload'

import { fieldIsVirtual } from 'payload/shared'
import toSnakeCase from 'to-snake-case'

import type { DrizzleAdapter } from '../../types.js'

import { resolveBlockTableName } from '../../utilities/validateExistingBlockIsIdentical.js'

/** Block rows reference the document, so removing their parent block cannot cascade to them. */
export const collectBlockTables = ({
  adapter,
  baseTableName,
  blocksToDelete,
  fields,
  visited = new Set<FlattenedBlock>(),
}: {
  adapter: DrizzleAdapter
  baseTableName: string
  blocksToDelete: Set<string>
  fields: FlattenedField[]
  visited?: Set<FlattenedBlock>
}): Set<string> => {
  for (const field of fields) {
    if (fieldIsVirtual(field)) {
      continue
    }

    if (field.type === 'blocks') {
      for (const block of field.blocks) {
        const definition =
          typeof block === 'string'
            ? (adapter.payload.blocks[block] ??
              adapter.payload.config.blocks.find((item) => item.slug === block))
            : block

        if (!definition || visited.has(definition)) {
          continue
        }
        visited.add(definition)
        blocksToDelete.add(
          resolveBlockTableName(
            definition,
            adapter.tableNameMap.get(`${baseTableName}_blocks_${toSnakeCase(definition.slug)}`),
          ),
        )
        collectBlockTables({
          adapter,
          baseTableName,
          blocksToDelete,
          fields: definition.flattenedFields,
          visited,
        })
      }
    } else if ('flattenedFields' in field) {
      collectBlockTables({
        adapter,
        baseTableName,
        blocksToDelete,
        fields: field.flattenedFields,
        visited,
      })
    }
  }

  return blocksToDelete
}
