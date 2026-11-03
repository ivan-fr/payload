import type { SerializedEditorState, SerializedParagraphNode, SerializedTextNode } from 'lexical'

/**
 * This function checks if the editor state is empty (has any text). If the editor state has no nodes,
 * or only empty paragraph nodes (no TextNode with length > 0), it returns false.
 * Otherwise, it returns true.
 */
export function hasText(
  value: null | SerializedEditorState | undefined,
): value is SerializedEditorState {
  const hasChildren = !!value?.root?.children?.length
  if (!hasChildren) {
    return false
  }

  return value.root.children.some((node) => {
    if (node.type !== 'paragraph') {
      return true
    }

    const paragraphNode = node as SerializedParagraphNode
    return (paragraphNode.children ?? []).some(
      (child) => child.type !== 'text' || Boolean((child as SerializedTextNode).text?.length),
    )
  })
}
