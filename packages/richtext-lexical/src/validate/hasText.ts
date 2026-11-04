import type { SerializedEditorState, SerializedLexicalNode, SerializedTextNode } from 'lexical'

import { getNodeChildren } from '../utilities/getNodeChildren.js'

/** Paragraphs and headings must contain text or a content node; line breaks alone are empty. */
export function hasText(
  value: null | SerializedEditorState | undefined,
): value is SerializedEditorState {
  return Boolean(value?.root?.children?.some(hasContent))
}

function hasContent(node: SerializedLexicalNode): boolean {
  if (node.type === 'text') {
    return Boolean((node as SerializedTextNode).text?.length)
  }
  if (node.type === 'linebreak') {
    return false
  }
  if (node.type === 'paragraph' || node.type === 'heading') {
    return getNodeChildren({ node }).some(hasContent)
  }
  return true
}
