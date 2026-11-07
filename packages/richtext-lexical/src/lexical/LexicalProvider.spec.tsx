import type { ReactNode } from 'react'

import { ContentEditable } from '@lexical/react/LexicalContentEditable.js'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary.js'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin.js'
import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { LexicalProvider } from './LexicalProvider.js'

vi.mock('@payloadcms/ui', () => ({ useEditDepth: () => 0 }))
vi.mock('../field/RichTextViewProvider.js', () => ({
  useRichTextView: () => ({ currentView: 'default', views: {} }),
}))
vi.mock('./config/client/EditorConfigProvider.js', () => ({
  EditorConfigProvider: ({ children }: { readonly children: ReactNode }) => children,
  useEditorConfigContext: () => undefined,
}))
vi.mock('./nodes/index.js', () => ({ getEnabledNodes: () => [] }))
vi.mock('./LexicalEditor.js', () => ({
  LexicalEditor: () => (
    <PlainTextPlugin
      contentEditable={<ContentEditable aria-label="Editor" />}
      placeholder={null}
      ErrorBoundary={LexicalErrorBoundary}
    />
  ),
}))

const Fixture = ({ readOnly }: { readonly readOnly: boolean }) => (
  <LexicalProvider
    composerKey="body.0"
    editorConfig={
      {
        lexical: { namespace: 'provider-focus-browser', theme: {} },
        features: { providers: [] },
      } as never
    }
    fieldProps={{} as never}
    isSmallWidthViewport={false}
    onChange={vi.fn()}
    readOnly={readOnly}
    value={undefined as never}
  />
)

test('should preserve the editor and focus when config identity changes during a save', async () => {
  const screen = await render(<Fixture readOnly={false} />)
  const editor = screen.getByRole('textbox', { name: 'Editor' })
  const element = editor.element()

  await editor.fill('Unsaved content')
  await expect.element(editor).toHaveFocus()
  await screen.rerender(<Fixture readOnly />)
  await expect.element(editor).toHaveAttribute('contenteditable', 'false')
  expect(editor.element()).toBe(element)
  await expect.element(editor).toHaveTextContent('Unsaved content')
  await screen.rerender(<Fixture readOnly={false} />)
  await expect.element(editor).toHaveAttribute('contenteditable', 'true')
  expect(editor.element()).toBe(element)
  await expect.element(editor).toHaveTextContent('Unsaved content')
  await expect.element(editor).toHaveFocus()
})
