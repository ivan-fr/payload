import type { CollectionConfig, Document, PayloadRequest } from 'payload'

import { APIError } from 'payload'

import type { NestedDocsPluginConfig } from '../types.js'

export const getParents = async (
  req: PayloadRequest,
  pluginConfig: Pick<NestedDocsPluginConfig, 'generateLabel' | 'generateURL' | 'parentFieldSlug'>,
  collection: CollectionConfig,
  doc: Record<string, unknown>,
  docs: Array<Record<string, unknown>> = [],
): Promise<Document[]> => {
  const parentSlug = pluginConfig?.parentFieldSlug || 'parent'
  const visitedIDs = new Set<string>()
  const visitedDocuments = new Set<Record<string, unknown>>()
  const ancestors: Array<Record<string, unknown>> = []
  let current: null | Record<string, unknown> = doc

  while (current) {
    const id = current.id
    if (visitedDocuments.has(current) || (id != null && visitedIDs.has(String(id)))) {
      throw new APIError('Cannot save nested documents: a parent cycle was detected.', 400)
    }
    visitedDocuments.add(current)
    if (id != null) visitedIDs.add(String(id))

    const parent: unknown = current[parentSlug]
    if (typeof parent === 'string' || typeof parent === 'number') {
      if (parent === '') break
      // Check before fetching so even a missing self-reference cannot become a breadcrumb.
      if (visitedIDs.has(String(parent))) {
        throw new APIError('Cannot save nested documents: a parent cycle was detected.', 400)
      }
      current = await req.payload.findByID({
        id: parent,
        collection: collection.slug,
        depth: 0,
        disableErrors: true,
        overrideAccess: true,
        req,
      })
    } else {
      current = parent && typeof parent === 'object' ? (parent as Record<string, unknown>) : null
    }
    if (current) ancestors.push(current)
  }

  return [...ancestors.reverse(), ...docs]
}
