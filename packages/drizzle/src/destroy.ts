import type { Destroy } from 'payload'

import type { DrizzleAdapter } from './types.js'

// eslint-disable-next-line @typescript-eslint/require-await
export const destroy: Destroy = async function destroy(this: DrizzleAdapter) {
  if (this.enums) {
    this.enums = {}
  }
  this.schema = {}
  this.tables = {}
  this.relations = {}
  this.fieldConstraints = {}
  this.drizzle = undefined
  this.initializing = new Promise((res, rej) => {
    this.resolveInitializing = res
    this.rejectInitializing = rej
  })
  // Reinitialization can fail before any transaction starts awaiting this promise.
  void this.initializing.catch(() => undefined)
}
