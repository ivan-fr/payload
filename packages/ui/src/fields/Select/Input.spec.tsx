import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

import { SelectInput } from './Input.js'

const mocks = vi.hoisted(() => ({ select: undefined as any }))
vi.mock('../../elements/ReactSelect/index.js', () => ({
  ReactSelect: (props: any) => {
    mocks.select = props
    return null
  },
}))
vi.mock('../../fields/FieldLabel/index.js', () => ({ FieldLabel: () => null }))
vi.mock('../../fields/FieldDescription/index.js', () => ({ FieldDescription: () => null }))
vi.mock('../../fields/FieldError/index.js', () => ({ FieldError: () => null }))
vi.mock('../../forms/Form/context.js', () => ({ useForm: () => ({ uuid: 'form' }) }))
vi.mock('../../providers/EditDepth/index.js', () => ({ useEditDepth: () => 0 }))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}))
afterEach(() => vi.unstubAllGlobals())
it.each([false, true])(
  'should ignore identical selection values and preserve real changes (many: %s) (#13851)',
  async (hasMany) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const change = vi.fn()
    const host = document.createElement('div')
    const root = createRoot(host)
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]
    try {
      await act(() =>
        root.render(
          <SelectInput
            name="status"
            path="status"
            options={options}
            value={hasMany ? ['a', 'b'] : 'a'}
            hasMany={hasMany}
            onChange={change}
          />,
        ),
      )
      const unchanged = hasMany
        ? options.map((o) => ({ ...o }))
        : { value: 'a', label: 'Translated A' }
      await act(() => mocks.select.onChange(unchanged))
      expect(change).not.toHaveBeenCalled()
      const changed = hasMany ? [options[1], options[0]] : options[1]
      await act(() => mocks.select.onChange(changed))
      expect(change).toHaveBeenCalledExactlyOnceWith(changed)
      await act(() => mocks.select.onChange(null))
      expect(change).toHaveBeenLastCalledWith(null)
    } finally {
      await act(() => root.unmount())
    }
  },
)
