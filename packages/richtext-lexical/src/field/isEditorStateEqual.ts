import type { SerializedEditorState } from 'lexical'

import { dequal } from 'dequal/lite'

/** Compare editor JSON while allowing adapters to represent absent fields as null. */
export function isEditorStateEqual({
  next,
  previous,
}: {
  next: null | SerializedEditorState | undefined
  previous: null | SerializedEditorState | undefined
}): boolean {
  return (
    previous === next ||
    dequal(normalizeEditorState({ state: previous }), normalizeEditorState({ state: next }))
  )
}

function normalizeEditorState({
  state,
}: {
  state: null | SerializedEditorState | undefined
}): unknown {
  if (state == null) {
    return undefined
  }

  // JSON serialization already omits undefined object properties. Omit null properties
  // as well, since database adapters can add them to empty block and upload fields.
  // Array positions remain intact, and dequal still ignores object key order.
  return JSON.parse(
    JSON.stringify(state, (_key, value: unknown) => (value === null ? undefined : value)),
  )
}
