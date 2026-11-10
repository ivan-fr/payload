import type { SelectType } from '../../../types/index.js'
import type { FlattenedBlock, FlattenedField } from '../../config/types.js'

type Args = {
  blocks: Record<string, FlattenedBlock>
  fields: FlattenedField[]
  targetPath: string[]
  visitedBlocks?: ReadonlySet<string>
}

/** Load hook dependencies while excluding unrelated virtual fields that could recurse. */
export const getHookDataSelect = ({
  blocks,
  fields,
  targetPath,
  visitedBlocks = new Set<string>(),
}: Args): SelectType | undefined => {
  const select: SelectType = {}

  for (const field of fields) {
    const isTarget = field.name === targetPath[0]

    if ('virtual' in field && field.virtual && !isTarget) {
      select[field.name] = false
      continue
    }

    const nested = getNestedHookDataSelect({
      blocks,
      field,
      targetPath: isTarget ? targetPath.slice(1) : [],
      visitedBlocks,
    })
    if (nested) {
      select[field.name] = nested
    }
  }

  return Object.keys(select).length > 0 ? select : undefined
}

function getNestedHookDataSelect({
  blocks,
  field,
  targetPath,
  visitedBlocks = new Set<string>(),
}: { field: FlattenedField } & Omit<Args, 'fields'>): SelectType | undefined {
  if ('flattenedFields' in field && Array.isArray(field.flattenedFields)) {
    return getHookDataSelect({ blocks, fields: field.flattenedFields, targetPath, visitedBlocks })
  }
  if (field.type !== 'blocks') {
    return undefined
  }

  const select: SelectType = {}
  for (const blockOrSlug of field.blocks) {
    const block = typeof blockOrSlug === 'string' ? blocks[blockOrSlug] : blockOrSlug
    if (!block || visitedBlocks.has(block.slug)) {
      continue
    }
    const nested = getHookDataSelect({
      blocks,
      fields: block.flattenedFields,
      targetPath: [],
      visitedBlocks: new Set([block.slug, ...visitedBlocks]),
    })
    if (nested) {
      select[block.slug] = nested
    }
  }
  return Object.keys(select).length > 0 ? select : undefined
}
