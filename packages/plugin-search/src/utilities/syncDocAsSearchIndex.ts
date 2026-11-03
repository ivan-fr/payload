import type { DocToSync, SyncDocArgs } from '../types.js'

export const syncDocAsSearchIndex = async ({
  collection,
  doc,
  locale,
  onSyncError,
  operation,
  pluginConfig,
  req: { payload },
  req,
}: SyncDocArgs) => {
  const { id, _status: status, title } = doc || {}
  const transactionID = await req.transactionID
  const hasParentTransaction =
    typeof transactionID === 'string' || typeof transactionID === 'number'

  const { beforeSync, defaultPriorities, deleteDrafts, searchOverrides, syncDrafts } = pluginConfig

  const searchSlug = searchOverrides?.slug || 'search'

  // Determine sync locale
  const syncLocale = locale || req.locale || undefined

  if (typeof pluginConfig.skipSync === 'function') {
    try {
      const skipSync = await pluginConfig.skipSync({
        collectionSlug: collection,
        doc,
        locale: syncLocale,
        req,
      })

      if (skipSync) {
        return doc
      }
    } catch (err) {
      req.payload.logger.error({
        err,
        msg: 'Search plugin: Error executing skipSync. Proceeding with sync.',
      })
    }
  }

  let dataToSave: DocToSync = {
    doc: {
      relationTo: collection,
      value: id,
    },
    title,
  }
  const docKeyPrefix = `${collection}:${id}`
  const docKey = req.payload.config.localization ? `${docKeyPrefix}:${syncLocale}` : docKeyPrefix
  const syncedDocsSet = (req.context?.syncedDocsSet as Set<string>) || new Set<string>()

  if (syncedDocsSet.has(docKey)) {
    /*
     * prevents duplicate syncing of documents in the same request
     * this can happen when hooks call `payload.update` within the create lifecycle
     * like the nested-docs plugin does
     */
    return doc
  } else {
    syncedDocsSet.add(docKey)
  }

  req.context.syncedDocsSet = syncedDocsSet

  if (typeof beforeSync === 'function') {
    let docToSyncWith = doc
    if (payload.config?.localization) {
      // Check if document is trashed (has deletedAt field)
      const isTrashDocument = doc && 'deletedAt' in doc && doc.deletedAt

      docToSyncWith = await payload.findByID({
        id,
        collection,
        locale: syncLocale,
        overrideAccess: true,
        req,
        // Include trashed documents when the document being synced is trashed
        trash: isTrashDocument,
      })
    }
    dataToSave = await beforeSync({
      collectionSlug: collection,
      originalDoc: docToSyncWith,
      payload,
      req,
      searchDoc: dataToSave,
    })
  }

  let defaultPriority = 0
  if (defaultPriorities) {
    const { [collection]: priority } = defaultPriorities

    if (typeof priority === 'function') {
      try {
        defaultPriority = await priority(doc)
      } catch (err: unknown) {
        payload.logger.error(err)
        payload.logger.error(
          `Error gathering default priority for ${searchSlug} documents related to ${collection}`,
        )
      }
    } else if (priority !== undefined) {
      defaultPriority = priority
    }
  }

  const doSync = syncDrafts || (!syncDrafts && status !== 'draft')

  try {
    if (operation === 'create' && doSync) {
      await payload.create({
        collection: searchSlug,
        data: { ...dataToSave, priority: defaultPriority },
        depth: 0,
        locale: syncLocale,
        overrideAccess: true,
        req,
      })
    }

    if (operation === 'update') {
      const searchDocQuery = await payload.find({
        collection: searchSlug,
        depth: 0,
        locale: syncLocale,
        overrideAccess: true,
        req,
        where: {
          'doc.relationTo': { equals: collection },
          'doc.value': { equals: id },
        },
      })
      const docs: Array<{ id: number | string; priority?: number }> = searchDocQuery?.docs || []
      const [foundDoc, ...duplicativeDocs] = docs

      if (duplicativeDocs.length > 0) {
        await payload.delete({
          collection: searchSlug,
          depth: 0,
          overrideAccess: true,
          req,
          where: { id: { in: duplicativeDocs.map(({ id }) => id) } },
        })
      }

      if (foundDoc) {
        const searchDocID = foundDoc.id
        const isTrashDocument = doc && 'deletedAt' in doc && doc.deletedAt
        if (isTrashDocument) {
          await payload.delete({
            id: searchDocID,
            collection: searchSlug,
            depth: 0,
            overrideAccess: true,
            req,
          })
        } else {
          if (doSync) {
            await payload.update({
              id: searchDocID,
              collection: searchSlug,
              data: { ...dataToSave, priority: foundDoc.priority || defaultPriority },
              depth: 0,
              locale: syncLocale,
              overrideAccess: true,
              req,
            })
          }
          if (deleteDrafts && status === 'draft') {
            const {
              docs: [docWithPublish],
            } = await payload.find({
              collection,
              depth: 0,
              draft: false,
              limit: 1,
              locale: syncLocale,
              overrideAccess: true,
              pagination: false,
              req,
              where: { and: [{ _status: { equals: 'published' } }, { id: { equals: id } }] },
            })
            if (!docWithPublish) {
              await payload.delete({
                id: searchDocID,
                collection: searchSlug,
                depth: 0,
                overrideAccess: true,
                req,
              })
            }
          }
        }
      } else if (doSync) {
        await payload.create({
          collection: searchSlug,
          data: { ...dataToSave, priority: defaultPriority },
          depth: 0,
          locale: syncLocale,
          overrideAccess: true,
          req,
        })
      }
    }
  } catch (err: unknown) {
    syncedDocsSet.delete(docKey)
    payload.logger.error({
      err,
      msg: `Error syncing ${searchSlug} document related to ${collection} with id: '${id}'.`,
    })
    onSyncError?.()
    // Standalone reindexing explicitly collects failures. A shared transaction
    // cannot recover after a failed write, so its caller must always see the error.
    if (!onSyncError || hasParentTransaction) {
      throw err
    }
  }

  return doc
}
