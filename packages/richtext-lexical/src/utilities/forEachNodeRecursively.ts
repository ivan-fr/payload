import type { SerializedLexicalNode } from 'lexical'

import { getNodeChildren } from './getNodeChildren.js'

export function recurseNodes({
  callback,
  nodes,
}: {
  callback: (node: SerializedLexicalNode) => void
  nodes: SerializedLexicalNode[]
}) {
  for (const node of nodes) {
    callback(node)

    const children = getNodeChildren({ node })
    if (children.length) {
      recurseNodes({ callback, nodes: children })
    }
  }
}

export async function recurseNodesAsync({
  callback,
  nodes,
}: {
  callback: (node: SerializedLexicalNode) => Promise<void>
  nodes: SerializedLexicalNode[]
}) {
  for (const node of nodes) {
    await callback(node)

    const children = getNodeChildren({ node })
    if (children.length) {
      await recurseNodesAsync({ callback, nodes: children })
    }
  }
}
