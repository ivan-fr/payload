import type { SlashMenuGroup } from './LexicalTypeaheadMenuPlugin/types.js'

export function mergeSlashMenuGroups({
  dynamicGroups,
  groups,
}: {
  dynamicGroups: SlashMenuGroup[]
  groups: SlashMenuGroup[]
}): SlashMenuGroup[] {
  const merged = [...groups]

  for (const dynamicGroup of dynamicGroups) {
    const index = merged.findIndex((group) => group.key === dynamicGroup.key)
    if (index === -1) {
      merged.push({ ...dynamicGroup, items: [...dynamicGroup.items] })
    } else {
      const group = merged[index]!
      merged[index] = { ...group, items: [...group.items, ...dynamicGroup.items] }
    }
  }

  return merged
}
