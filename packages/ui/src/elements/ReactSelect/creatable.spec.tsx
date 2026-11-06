import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { components } from 'react-select'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { ReactSelectAdapterProps } from './types.js'

import { ReactSelect } from './index.js'

vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', fallbackLanguage: 'en' },
    t: (key: string) => key,
  }),
}))

let inputProps: any
const selectComponents = {
  ...components,
  Input: (props: any) => {
    inputProps = props
    return <components.Input {...props} />
  },
}
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
async function enterOption(props: Partial<ReactSelectAdapterProps>) {
  await act(() =>
    root.render(
      <ReactSelect
        aria-label="Tags"
        components={selectComponents}
        isCreatable
        isMulti
        menuPortalTarget={null}
        options={[]}
        value={[]}
        {...props}
      />,
    ),
  )
  await act(() =>
    inputProps.onChange({ currentTarget: { value: 'new-tag' }, target: { value: 'new-tag' } }),
  )
  await act(() =>
    container
      .querySelector('input')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }),
      ),
  )
}

it('should call onCreateOption instead of onChange when provided (#14635)', async () => {
  const onCreateOption = vi.fn()
  const onChange = vi.fn()
  await enterOption({ onCreateOption, onChange })
  expect(onCreateOption).toHaveBeenCalledExactlyOnceWith('new-tag')
  expect(onChange).not.toHaveBeenCalled()
})

it('should respect isValidNewOption on keyboard creation', async () => {
  const onChange = vi.fn()
  await enterOption({ onChange, isValidNewOption: () => false })
  expect(onChange).not.toHaveBeenCalled()
})

it('should use getNewOptionData when creating a value', async () => {
  const onChange = vi.fn()
  await enterOption({
    onChange,
    getNewOptionData: (value) => ({ value: value.toUpperCase(), label: 'Custom label' }),
  })
  expect(onChange).toHaveBeenCalledWith(
    [{ value: 'NEW-TAG', label: 'Custom label' }],
    expect.anything(),
  )
})

it('should create a single value through the native creatable path', async () => {
  const onChange = vi.fn()
  await enterOption({ onChange, isMulti: false, value: undefined })
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ value: 'new-tag', label: 'new-tag' }),
    expect.objectContaining({ action: 'create-option' }),
  )
})
