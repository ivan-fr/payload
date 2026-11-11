import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { Button } from './index.js'

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  container.style.setProperty('--stroke-width-small', '1px')
  container.style.setProperty('--special-border-translucent', 'black')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it.each([false, true])(
  'should retain the icon-only dashed border (disabled: %s) (#19397)',
  async (isDisabled) => {
    await act(() =>
      root.render(
        <Button aria-label="Add" buttonStyle="dashed" disabled={isDisabled} icon="plus" />,
      ),
    )

    const button = container.querySelector('button')!
    const style = getComputedStyle(button)

    expect(style.borderTopWidth).toBe('1px')
    expect(style.borderTopStyle).toBe('dashed')
    expect(button.getAttribute('aria-label')).toBe('Add')
    expect(button.disabled).toBe(isDisabled)
  },
)
