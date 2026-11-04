import type { Payload } from 'payload'

/** A valid but absent ID for the adapter's default document and version columns. */
export const getMissingID = ({ payload }: { payload: Payload }): number | string => {
  if (payload.db.defaultIDType === 'number') {
    return 2147483647
  }
  return payload.db.name === 'mongoose'
    ? 'ffffffffffffffffffffffff'
    : '00000000-0000-4000-8000-ffffffffffff'
}
