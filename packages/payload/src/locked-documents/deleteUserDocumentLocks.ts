import type { SanitizedCollectionConfig } from '../collections/config/types.js'
import type { PayloadRequest } from '../types/index.js'

import { lockedDocumentsCollectionSlug } from './config.js'

/**
 * Deletes the document locks owned by users that are about to be deleted.
 *
 * Must run before the users are deleted: SQL cascades remove the lock's user relationship
 * together with the user, which would leave an ownerless lock behind that can no longer be matched.
 */
export const deleteUserDocumentLocks = async ({
  collectionConfig,
  ids,
  req,
}: {
  collectionConfig: SanitizedCollectionConfig
  /**
   * IDs of the users that are about to be deleted
   */
  ids: (number | string)[]
  req: PayloadRequest
}): Promise<void> => {
  if (
    !collectionConfig.auth ||
    !ids.length ||
    !req.payload.collections[lockedDocumentsCollectionSlug]
  ) {
    return
  }

  await req.payload.db.deleteMany({
    collection: lockedDocumentsCollectionSlug,
    req,
    where: {
      and: [
        { 'user.value': { in: ids } },
        { 'user.relationTo': { equals: collectionConfig.slug } },
      ],
    },
  })
}
