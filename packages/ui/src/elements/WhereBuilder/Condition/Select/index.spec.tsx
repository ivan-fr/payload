import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Select } from './index.js'

vi.mock('../../../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}))
vi.mock('../../../ReactSelect/index.js', () => ({
  ReactSelect: ({ value }: any) => <output>{JSON.stringify(value)}</output>,
}))
const options = ['a', 'b']
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

describe('select filter normalization (#17248)', () => {
  it('should normalize an array once despite a changed parent callback and equivalent URL array', async () => {
    const onChange = vi.fn()
    const render = (callback: typeof onChange, value = ['a', 'b']) => (
      <Select
        field={{ admin: {} } as never}
        onChange={callback}
        operator="equals"
        options={options}
        value={value}
      />
    )
    await act(() => root.render(render(onChange)))
    expect(onChange).toHaveBeenCalledWith('a')
    const nextCallback = vi.fn()
    await act(() => root.render(render(nextCallback)))
    await act(() => root.render(render(vi.fn())))
    expect(nextCallback).not.toHaveBeenCalled()
    expect(container.textContent).toBe(JSON.stringify({ label: 'a', value: 'a' }))
    const changed = vi.fn()
    await act(() => root.render(render(changed, ['b'])))
    expect(changed).toHaveBeenCalledWith('b')
  })
})
