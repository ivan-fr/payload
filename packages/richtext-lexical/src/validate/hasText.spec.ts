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
  it.each(['text', 'upload', 'block'])('should preserve existing content rules for %s', (type) => {
    const node =
      type === 'text'
        ? paragraph({ children: [text({ value: 'content' })] })
        : { type, version: 1, children: [] }
    expect(hasText(state({ children: [paragraph(), node] }))).toBe(true)
  })
  it.each([
    paragraph({ children: [{ type: 'linebreak', version: 1 }] }),
    { type: 'heading', version: 1, tag: 'h2', children: [] },
    {
      type: 'heading',
      version: 1,
      tag: 'h2',
      children: [text({ value: '' }), { type: 'linebreak', version: 1 }],
    },
  ])('should reject text-free paragraphs and headings (#19227): %j', async (node) => {
    const value = state({ children: [node] })
    expect(hasText(value)).toBe(false)
    const validate = richTextValidateHOC({
      editorConfig: { features: { validations: new Map() } } as never,
    })
    expect(await validate(value, { required: true, req: { t: () => 'Required' } } as never)).toBe(
      'Required',
    )
  })

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

it('should preserve nonempty headings, whitespace policy, and named-slot content', () => {
  for (const value of ['text', ' ']) {
    expect(
      hasText(
        state({
          children: [{ type: 'heading', version: 1, children: [text({ value })] } as never],
        }),
      ),
    ).toBe(true)
  }
  expect(
    hasText(
      state({
        children: [
          {
            type: 'paragraph',
            version: 1,
            children: [],
            $slots: { body: { type: 'upload', version: 1 } },
          } as never,
        ],
      }),
    ),
  ).toBe(true)
  for (const type of ['list', 'quote', 'table', 'custom-decorator']) {
    expect(hasText(state({ children: [{ type, version: 1, children: [] } as never] }))).toBe(true)
  }
})
