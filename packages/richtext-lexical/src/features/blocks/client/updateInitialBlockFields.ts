import type { LexicalEditor } from 'lexical'

import { HISTORY_MERGE_TAG, SKIP_DOM_SELECTION_TAG } from 'lexical'

/** Server-resolved defaults belong to the preceding edit, rather than a separate undo step. */
export function updateInitialBlockFields({
  editor,
  update,
}: {
  editor: LexicalEditor
  update: () => void
}): void {
  editor.update(update, { tag: [SKIP_DOM_SELECTION_TAG, HISTORY_MERGE_TAG] })
}
