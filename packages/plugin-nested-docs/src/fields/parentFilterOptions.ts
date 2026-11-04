import type { FilterOptionsProps, Where } from 'payload'

import type { NestedDocsPluginConfig } from '../types.js'

export const parentFilterOptions =
  (
    _breadcrumbsFieldSlug?: string,
    { parentFieldSlug = 'parent' }: Pick<NestedDocsPluginConfig, 'parentFieldSlug'> = {},
  ): ((args: FilterOptionsProps) => Promise<boolean | Where>) =>
  async ({ id, relationTo, req }) => {
    if (id === undefined || id === null) return true

    const excluded = new Map<string, number | string>([[String(id), id]])
    let frontier: Array<number | string> = [id]

    // Read the actual subtree, since negating a has-many breadcrumb join can match
    // a different row on SQL adapters. Include hidden descendants for cycle safety;
    // the relationship query still applies the caller's normal read access.
    while (frontier.length) {
      const { docs } = await req.payload.find({
        collection: relationTo,
        depth: 0,
        limit: 0,
        overrideAccess: true,
        pagination: false,
        req,
        select: { id: true },
        where: { [parentFieldSlug]: { in: frontier } },
      })
      frontier = []
      for (const child of docs) {
        if (!excluded.has(String(child.id))) {
          excluded.set(String(child.id), child.id)
          frontier.push(child.id)
        }
      }
    }
    return { id: { not_in: [...excluded.values()] } }
  }
