import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

import { SelectInput } from './Input.js'

vi.mock('../../forms/Form/context.js', () => ({ useForm: () => ({ uuid: 'select-form' }) }))
vi.mock('../../providers/EditDepth/index.js', () => ({ useEditDepth: () => 0 }))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', fallbackLanguage: 'en' },
    t: (key: string) => key,
  }),
}))
vi.mock('../../fields/FieldError/index.js', () => ({ FieldError: () => null }))
it('should close the menu and retain focus when reselecting the current value by keyboard (#13851)', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const change = vi.fn()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(() =>
      root.render(
        <SelectInput
          name="status"
          path="status"
          label="Status"
          value="a"
          options={[
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ]}
          onChange={change}
        />,
      ),
    )
    const input = host.querySelector<HTMLInputElement>('[role="combobox"]')!
    expect(input.getAttribute('aria-label')).toBe('Status')
    await act(() => input.focus())
    const press = async (key: string) =>
      act(() =>
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }),
        ),
      )
    await press('ArrowDown')
    expect(input.getAttribute('aria-expanded')).toBe('true')
    await press('Enter')
    expect(change).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(input)
    await press('ArrowDown')
    await press('ArrowDown')
    await press('Enter')
    expect(change).toHaveBeenCalledOnce()
    expect(change.mock.calls[0]![0]).toMatchObject({ value: 'b' })
  } finally {
    await act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
