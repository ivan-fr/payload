import { createEmptyHistoryState, HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin.js'
import { LexicalComposerContext } from '@lexical/react/LexicalComposerContext.js'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  createEditor,
  HISTORY_PUSH_TAG,
  UNDO_COMMAND,
  REDO_COMMAND,
} from 'lexical'
import { describe, expect, it, vi } from 'vitest'

import { ServerBlockNode } from '../server/nodes/BlocksNode.js'
import { ServerInlineBlockNode } from '../server/nodes/InlineBlocksNode.js'
import { updateInitialBlockFields } from './updateInitialBlockFields.js'

describe('block default history (#18403)', () => {
  it.each([false, true])(
    'should remove a newly inserted block with one undo after defaults resolve (inline=%s)',
    async (isInline) => {
      const editor = createEditor({
        nodes: [ServerBlockNode, ServerInlineBlockNode],
        onError: (error) => {
          throw error
        },
      })
      const history = createEmptyHistoryState()
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
      const container = document.createElement('div')
      const root = createRoot(container)
      await act(() =>
        root.render(
          <LexicalComposerContext value={[editor, { getTheme: () => null }]}>
            <HistoryPlugin delay={0} externalHistoryState={history} />
          </LexicalComposerContext>,
        ),
      )
      let key = ''
      const flush = async () => {
        await act(async () => {})
      }
      try {
        editor.update(
          () => {
            $getRoot().append($createParagraphNode())
          },
          { discrete: true },
        )
        editor.update(
          () => {
            const node = new (isInline ? ServerInlineBlockNode : ServerBlockNode)({
              fields: { id: 'test', blockType: 'note' },
            })
            key = node.getKey()
            if (isInline) {
              $getRoot().getFirstChildOrThrow().append(node)
            } else {
              $getRoot().append(node)
            }
          },
          { discrete: true, tag: HISTORY_PUSH_TAG },
        )
        updateInitialBlockFields({
          editor,
          update: () => {
            const node = $getNodeByKey(key) as ServerBlockNode | ServerInlineBlockNode
            node.setFields({ ...node.getFields(), text: 'Server default' }, true)
          },
        })
        await flush()
        editor.dispatchCommand(UNDO_COMMAND, undefined)
        await flush()
        editor.getEditorState().read(() => expect($getNodeByKey(key)).toBeNull())
        editor.dispatchCommand(REDO_COMMAND, undefined)
        await flush()
        editor.getEditorState().read(() => {
          const node = $getNodeByKey(key) as ServerBlockNode | ServerInlineBlockNode
          expect(node.getFields().text).toBe('Server default')
        })
      } finally {
        await act(() => root.unmount())
        vi.unstubAllGlobals()
      }
    },
  )
})
