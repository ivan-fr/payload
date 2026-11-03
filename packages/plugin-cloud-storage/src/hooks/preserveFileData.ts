import type { CollectionBeforeChangeHook, FileData, TypeWithID } from 'payload'

/**
 * Keeps the current upload's buffers request-local when metadata writes clear req.file.
 */
export const getPreserveFileDataHook =
  (): CollectionBeforeChangeHook<FileData & TypeWithID> =>
  ({ req }) => {
    if (req.file) {
      req.context = {
        ...req.context,
        _payloadCloudStorage: {
          file: req.file,
          uploadSizes: req.payloadUploadSizes,
        },
      }
    }
  }
