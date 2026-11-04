import type { CollectionAfterDeleteHook } from '../../index.js'

type Args = {
  hasManyCollections?: string[]
  relatedCollections: Record<string, string>
}

export const hierarchyCollectionAfterDelete =
  ({ hasManyCollections = [], relatedCollections }: Args): CollectionAfterDeleteHook =>
  async ({ id, req }) => {
    for (const [collectionSlug, fieldName] of Object.entries(relatedCollections)) {
      const where = { [fieldName]: { equals: id } }

      if (hasManyCollections.includes(collectionSlug)) {
        const { docs } = await req.payload.find({
          collection: collectionSlug,
          depth: 0,
          overrideAccess: true,
          pagination: false,
          req,
          select: { [fieldName]: true },
          where,
        })

        for (const doc of docs) {
          await req.payload.update({
            id: doc.id,
            collection: collectionSlug,
            data: {
              [fieldName]: (doc[fieldName] || []).filter(
                (tagID: number | string) => String(tagID) !== String(id),
              ),
            },
            overrideAccess: true,
            req,
          })
        }
      } else {
        await req.payload.update({
          collection: collectionSlug,
          data: { [fieldName]: null },
          overrideAccess: true,
          req,
          where,
        })
      }
    }
  }
