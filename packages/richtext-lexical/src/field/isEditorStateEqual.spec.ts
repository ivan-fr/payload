import type { SerializedEditorState } from 'lexical'

import { describe, expect, it } from 'vitest'

import { isEditorStateEqual } from './isEditorStateEqual.js'

const editorState = ({ fields }: { fields: Record<string, unknown> }): SerializedEditorState =>
  ({
    root: {
      children: [
        { children: [{ text: 'Upload Node:more', type: 'text', version: 1 }], type: 'paragraph' },
        { fields, type: 'block', version: 1 },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as SerializedEditorState

describe('isEditorStateEqual', () => {
  it('should preserve an editor when a save adds null to empty nested block fields', () => {
    const current = editorState({ fields: { subBlocks: [{ id: 'nested', blockType: 'content' }] } })
    const saved = editorState({
      fields: {
        richText: null,
        subBlocks: [{ blockName: null, blockType: 'content', id: 'nested' }],
      },
    })

    expect(isEditorStateEqual({ previous: current, next: saved })).toBe(true)
    expect(isEditorStateEqual({ previous: saved, next: current })).toBe(true)
    expect(current.root.children[1]).not.toHaveProperty('fields.richText')
  })

  it.each([null, undefined])('should treat %s as an empty editor state', (empty) => {
    expect(isEditorStateEqual({ previous: empty, next: undefined })).toBe(true)
    expect(isEditorStateEqual({ previous: editorState({ fields: {} }), next: empty })).toBe(false)
  })

  it('should detect external text changes', () => {
    const current = editorState({ fields: {} })
    const changed = JSON.parse(JSON.stringify(current)) as SerializedEditorState

    Object.assign(changed.root.children[0], { children: [{ text: 'Replaced text', type: 'text' }] })

    expect(isEditorStateEqual({ previous: current, next: changed })).toBe(false)
  })

  it.each([false, 0, '', [], { root: { children: [] } }])(
    'should detect a substantive block field value: %j',
    (value) => {
      expect(
        isEditorStateEqual({
          previous: editorState({ fields: { value: null } }),
          next: editorState({ fields: { value } }),
        }),
      ).toBe(false)
    },
  )

  it('should preserve array positions when comparing empty values', () => {
    expect(
      isEditorStateEqual({
        previous: editorState({ fields: { values: [null, 'a'] } }),
        next: editorState({ fields: { values: ['a'] } }),
      }),
    ).toBe(false)
  })
})
