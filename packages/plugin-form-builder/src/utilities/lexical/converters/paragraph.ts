import type { HTMLConverter } from '../types.js'

import { convertLexicalNodesToHTML } from '../serializeLexical.js'

export const ParagraphHTMLConverter: HTMLConverter<any> = {
  async converter({ converters, node, parent, submissionData }) {
    const childrenText = await convertLexicalNodesToHTML({
      converters,
      lexicalNodes: node.children,
      parent: {
        ...node,
        parent,
      },
      submissionData,
    })
    const tag = childrenText.includes('<table>') ? 'div' : 'p'
    return `<${tag}>${childrenText}</${tag}>`
  },
  nodeTypes: ['paragraph'],
}
