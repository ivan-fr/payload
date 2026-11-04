import type { SerializedLexicalNode } from 'lexical'

/** Serialized Lexical children include both the normal list and experimental named slots. */
export function getNodeChildren({
  node,
}: {
  node: SerializedLexicalNode
}): SerializedLexicalNode[] {
  const children =
    'children' in node && Array.isArray(node.children)
      ? (node.children as SerializedLexicalNode[])
      : []
  const slots = '$slots' in node ? node.$slots : undefined

  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) {
    return children
  }

  const slotNodes = Object.values(slots).filter(
    (slot): slot is SerializedLexicalNode =>
      slot !== null &&
      typeof slot === 'object' &&
      !Array.isArray(slot) &&
      typeof slot.type === 'string',
  )

  return [...children, ...slotNodes]
}
