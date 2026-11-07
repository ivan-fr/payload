import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { DefaultFilter } from './index.js'

vi.mock('../../../../providers/Translation/index.js', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', fallbackLanguage: 'en' },
    t: (key: string) => key,
  }),
}))
vi.mock('../../../ReactSelect/index.js', () => ({
  ReactSelect: ({ options, value, onChange, placeholder, disabled }) => (
    <select
      aria-label={placeholder || 'Filter value'}
      disabled={disabled}
      value={value?.value ?? ''}
      onChange={(event) => onChange(options.find((option) => option.value === event.target.value))}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it.each([undefined, { field: { name: 'title', type: 'text', admin: {} } }])(
  'should render and edit exists for unavailable/known fields (#19407): %o',
  async (internalField) => {
    const onChange = vi.fn()
    await act(() =>
      root.render(
        <DefaultFilter
          booleanSelect
          disabled={false}
          internalField={internalField as never}
          onChange={onChange}
          operator="exists"
          options={[
            { label: 'True', value: 'true' },
            { label: 'False', value: 'false' },
          ]}
          value="false"
        />,
      ),
    )
    const select = container.querySelector('select')!
    expect(select.value).toBe('false')
    await act(() => {
      select.value = 'true'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledExactlyOnceWith('true')
  },
)
