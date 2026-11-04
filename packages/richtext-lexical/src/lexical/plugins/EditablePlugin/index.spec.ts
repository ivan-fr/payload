import type { LexicalEditor } from 'lexical'

import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ editor: null as LexicalEditor | null }))
vi.mock('@lexical/react/LexicalComposerContext.js', () => ({
  useLexicalComposerContext: () => [fixture.editor],
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void) => effect(),
}))
import { EditablePlugin } from './index.js'

describe('Lexical editability after form initialization', () => {
  it('should enable an initially disabled editor and retain edits across processing transitions', () => {
    const editor = createEditor({
      editable: false,
      namespace: 'editable-test',
      onError: (error) => {
        throw error
      },
    })
    fixture.editor = editor
    editor.update(
      () => {
        $getRoot().append($createParagraphNode().append($createTextNode('Unsaved content')))
      },
      { discrete: true },
    )
    const before = editor.getEditorState().toJSON()
    const transitions: boolean[] = []
    const unregister = editor.registerEditableListener((value) => transitions.push(value))
    try {
      renderToStaticMarkup(createElement(EditablePlugin, { readOnly: false }))
      expect(editor.isEditable()).toBe(true)
      renderToStaticMarkup(createElement(EditablePlugin, { readOnly: true }))
      expect(editor.isEditable()).toBe(false)
      renderToStaticMarkup(createElement(EditablePlugin, { readOnly: false }))
      expect(editor.isEditable()).toBe(true)
      expect(editor.getEditorState().toJSON()).toEqual(before)
      expect(transitions).toEqual([true, false, true])
    } finally {
      unregister()
    }
  })
})
