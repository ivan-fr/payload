import type { CollectionAfterChangeHook } from 'payload'

export const refreshVariantTitles =
  ({ variantsSlug }: { variantsSlug: string }): CollectionAfterChangeHook =>
  async ({ doc, operation, previousDoc, req }) => {
    if (operation !== 'update' || doc.title === previousDoc?.title) {
      return doc
    }

    const { docs } = await req.payload.find({
      collection: variantsSlug,
      depth: 0,
      draft: true,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { id: true, _status: true, options: true },
      where: { product: { equals: doc.id } },
    })
    for (const variant of docs) {
      await req.payload.update({
        id: variant.id,
        collection: variantsSlug,
        data: { options: variant.options, product: doc.id },
        draft: doc._status === 'draft' || variant._status === 'draft',
        overrideAccess: true,
        req,
      })
    }
    return doc
  }
