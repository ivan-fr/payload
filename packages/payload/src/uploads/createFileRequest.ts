import type { PayloadRequest } from '../types/index.js'

import { isolateObjectProperty } from '../utilities/isolateObjectProperty.js'
import { shareFileOperationScope } from './fileVersioning/fileOperationManager.js'

/** Isolates Local API upload input while sharing the caller's commit/rollback lifecycle. */
export const createFileRequest = ({ req }: { req: PayloadRequest }): PayloadRequest => {
  const fileReq = isolateObjectProperty(req, 'file')
  shareFileOperationScope({ owner: req, req: fileReq })
  return fileReq
}
