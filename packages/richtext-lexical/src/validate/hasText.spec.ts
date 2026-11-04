import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

import { describe, expect, it } from 'vitest'

import { hasText } from './hasText.js'
import { richTextValidateHOC } from './index.js'

const state = ({ children }: { children: SerializedLexicalNode[] }) =>
  ({
    root: { type: 'root', version: 1, children, direction: null, format: '', indent: 0 },
  }) as SerializedEditorState
const paragraph = ({ children = [] }: { children?: SerializedLexicalNode[] } = {}) => ({
  type: 'paragraph',
  version: 1,
  children,
})
const text = ({ value }: { value: string }) => ({ type: 'text', version: 1, text: value })

describe('multiple empty required paragraphs (#19222)', () => {
  it.each([1, 2, 5])(
    'should reject %s empty paragraphs and preserve required validation',
    async (count) => {
      const value = state({ children: Array.from({ length: count }, () => paragraph()) })
      expect(hasText(value)).toBe(false)
      const validate = richTextValidateHOC({
        editorConfig: { features: { validations: new Map() } } as never,
      })
      expect(
        await validate(value, {
          required: true,
          req: { t: () => 'This field is required.' },
        } as never),
      ).toBe('This field is required.')
    },
  )
  it('should reject paragraphs containing only empty text nodes', () => {
    expect(
      hasText(
        state({
          children: [
            paragraph({ children: [text({ value: '' }), text({ value: '' })] }),
            paragraph(),
          ],
        }),
      ),
    ).toBe(false)
  })
  it.each(['text', 'upload', 'block', 'linebreak', 'heading'])(
    'should preserve existing content rules for %s',
    (type) => {
      const node =
        type === 'text'
          ? paragraph({ children: [text({ value: 'content' })] })
          : type === 'linebreak'
            ? paragraph({ children: [{ type, version: 1 }] })
            : { type, version: 1, children: [] }
      expect(hasText(state({ children: [paragraph(), node] }))).toBe(true)
    },
  )
  it('should keep optional empty rich text valid', async () => {
    const validate = richTextValidateHOC({
      editorConfig: { features: { validations: new Map() } } as never,
    })
    expect(
      await validate(state({ children: [] }), {
        required: false,
        req: { t: () => 'Required' },
      } as never),
    ).toBe(true)
  })
})
