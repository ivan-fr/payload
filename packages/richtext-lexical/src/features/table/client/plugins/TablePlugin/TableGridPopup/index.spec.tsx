import { createEditor } from 'lexical'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { TableGridPopup } from './index.js'

vi.mock('@payloadcms/ui', () => ({
  useTranslation: () => ({ t: () => 'Close' }),
}))

const Fixture = () => {
  const [isOpen, setIsOpen] = useState(true)
  const [editor] = useState(() => createEditor({ namespace: 'table-popup-dismissal' }))

  return (
    <TableGridPopup
      anchorElem={document.body}
      editor={editor}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onInsert={vi.fn()}
      position={{ left: 0, top: 0 }}
    />
  )
}

test.each(['{Enter}', ' '])('should dismiss with the native close button using %s', async (key) => {
  await render(<Fixture />)
  const closeButton = page.getByRole('button', { name: 'Close', exact: true })

  await expect.element(closeButton).toBeVisible()
  closeButton.element().focus()
  await userEvent.keyboard(key)
  await expect.element(closeButton).not.toBeInTheDocument()
})

test('should preserve Escape dismissal from the dimension inputs', async () => {
  await render(<Fixture />)
  const columns = page.getByRole('spinbutton', { name: 'Columns' })

  await columns.fill('3')
  await userEvent.keyboard('{Escape}')
  await expect.element(columns).not.toBeInTheDocument()
})

test('should dismiss with a pointer click outside the popup', async () => {
  await render(<Fixture />)
  const closeButton = page.getByRole('button', { name: 'Close', exact: true })

  await closeButton.click()
  await expect.element(closeButton).not.toBeInTheDocument()
})
