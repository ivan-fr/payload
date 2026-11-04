import type { FlattenedBlock, FlattenedField } from 'payload'

import { getBlockFlattenedFields, getNestedFlattenedFields } from './flattenedFields.js'

/** Resolve schema names before interpreting underscores as structural separators.
 * The longest matching field name wins when the legacy CSV encoding is ambiguous.
 */
export const resolveCSVPath = ({
  fields,
  flatKey,
  localeCodes = [],
}: {
  fields: FlattenedField[]
  flatKey: string
  localeCodes?: string[]
}): string[] => {
  const field = fields
    .filter(({ name }) => name && (flatKey === name || flatKey.startsWith(`${name}_`)))
    .sort((a, b) => b.name.length - a.name.length)[0]

  if (!field) {
    return flatKey.split('_')
  }

  const segments = [field.name]
  let remaining = flatKey.slice(field.name.length + 1)
  if (!remaining) {
    return segments
  }

  if (field.localized) {
    const locale =
      [...localeCodes]
        .sort((a, b) => b.length - a.length)
        .find((code) => remaining === code || remaining.startsWith(`${code}_`)) ??
      remaining.match(/^[a-z]{2}(?:_[A-Z]{2})?(?=_|$)/)?.[0]
    if (locale) {
      segments.push(locale)
      remaining = remaining.slice(locale.length + 1)
    }
  }

  if (field.type === 'array' || field.type === 'blocks') {
    const index = remaining.match(/^\d+(?=_|$)/)?.[0]
    if (index) {
      segments.push(index)
      remaining = remaining.slice(index.length + 1)
    }
  }

  let nestedFields = getNestedFlattenedFields(field)
  if (field.type === 'blocks') {
    const block = (field.blocks ?? [])
      .filter(
        (block): block is FlattenedBlock =>
          typeof block !== 'string' &&
          (remaining === block.slug || remaining.startsWith(`${block.slug}_`)),
      )
      .sort((a, b) => b.slug.length - a.slug.length)[0]
    if (block) {
      segments.push(block.slug)
      remaining = remaining.slice(block.slug.length + 1)
      nestedFields = getBlockFlattenedFields(block)
    }
  }

  if (remaining) {
    segments.push(
      ...(nestedFields
        ? resolveCSVPath({ fields: nestedFields, flatKey: remaining, localeCodes })
        : remaining.split('_')),
    )
  }
  return segments
}
