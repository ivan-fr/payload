import { LexicalComposer } from '@lexical/react/LexicalComposer.js'
import { ContentEditable } from '@lexical/react/LexicalContentEditable.js'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary.js'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin.js'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { EditablePlugin } from './index.js'

const initialConfig = {
  editable: false,
  namespace: 'editable-plugin-browser',
  onError: (error: Error) => {
    throw error
  },
}
const Fixture = ({ readOnly }: { readOnly: boolean }) => (
  <LexicalComposer initialConfig={initialConfig}>
    <EditablePlugin readOnly={readOnly} />
    <PlainTextPlugin
      contentEditable={<ContentEditable aria-label="Editor" />}
      placeholder={null}
      ErrorBoundary={LexicalErrorBoundary}
    />
  </LexicalComposer>
)

test('should enable the same editor after initialization and retain text through processing', async () => {
  const screen = await render(<Fixture readOnly />)
  const editor = screen.getByRole('textbox', { name: 'Editor' })
  const element = editor.element()
  await expect.element(editor).toHaveAttribute('contenteditable', 'false')
  await screen.rerender(<Fixture readOnly={false} />)
  await expect.element(editor).toHaveAttribute('contenteditable', 'true')
  await editor.fill('Unsaved content')
  await screen.rerender(<Fixture readOnly />)
  await expect.element(editor).toHaveAttribute('contenteditable', 'false')
  await expect.element(editor).toHaveTextContent('Unsaved content')
  await screen.rerender(<Fixture readOnly={false} />)
  await expect.element(editor).toHaveAttribute('contenteditable', 'true')
  expect(editor.element()).toBe(element)
  await expect.element(editor).toHaveTextContent('Unsaved content')
})
