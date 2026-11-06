import type { OptionGroup } from './types.js'

/** Failed-load placeholders do not establish that a selected document has been loaded. */
export function getRelationshipIDsToLoad({
  ids,
  options,
  relation,
}: {
  ids: (number | string)[]
  options: OptionGroup[]
  relation: string
}): (number | string)[] {
  return ids.filter(
    (id) =>
      !options.some((group) =>
        group.options.some(
          (option) => option.value === id && option.relationTo === relation && option.doc,
        ),
      ),
  )
}
