import type { SanitizedCollectionConfig } from '../collections/config/types.js'
import type { PayloadRequest } from '../types/index.js'

import { preferencesCollectionSlug } from './config.js'

/** Capture ownership before SQL cascades remove the user relationship. */
export const getUserPreferenceIDs = async ({
  collectionConfig,
  ids,
  req,
}: {
  collectionConfig: SanitizedCollectionConfig
  ids: (number | string)[]
  req: PayloadRequest
}): Promise<(number | string)[]> => {
  if (!collectionConfig.auth || !ids.length) {
    return []
  }
  const { docs } = await req.payload.db.find({
    collection: preferencesCollectionSlug,
    limit: 0,
    pagination: false,
    req,
    select: { id: true },
    where: {
      and: [
        { 'user.value': { in: ids } },
        { 'user.relationTo': { equals: collectionConfig.slug } },
      ],
    },
  })
  return docs.map(({ id }) => id)
}
