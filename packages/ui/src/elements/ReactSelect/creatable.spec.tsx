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
async function enterOption({
  props,
  key = 'Enter',
  inputValue = 'new-tag',
  isComposing = false,
}: {
  props: Partial<ReactSelectAdapterProps>
  key?: string
  inputValue?: string
  isComposing?: boolean
}) {
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
    inputProps.onChange({ currentTarget: { value: inputValue }, target: { value: inputValue } }),
  )
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    isComposing,
    keyCode: key === 'Tab' ? 9 : 13,
    bubbles: true,
    cancelable: true,
  })
  await act(() => container.querySelector('input')!.dispatchEvent(event))
  return event
}

it('should call onCreateOption instead of onChange when provided (#14635)', async () => {
  const onCreateOption = vi.fn()
  const onChange = vi.fn()
  await enterOption({ props: { onCreateOption, onChange } })
  expect(onCreateOption).toHaveBeenCalledExactlyOnceWith('new-tag')
  expect(onChange).not.toHaveBeenCalled()
})

it('should respect isValidNewOption on keyboard creation', async () => {
  const onChange = vi.fn()
  await enterOption({ props: { onChange, isValidNewOption: () => false } })
  expect(onChange).not.toHaveBeenCalled()
})

it('should use getNewOptionData when creating a value', async () => {
  const onChange = vi.fn()
  await enterOption({
    props: {
      onChange,
      getNewOptionData: (value) => ({ value: value.toUpperCase(), label: 'Custom label' }),
    },
  })
  expect(onChange).toHaveBeenCalledWith(
    [{ value: 'NEW-TAG', label: 'Custom label' }],
    expect.anything(),
  )
})

it('should create a single value through the native creatable path', async () => {
  const onChange = vi.fn()
  await enterOption({ props: { onChange, isMulti: false, value: undefined } })
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ value: 'new-tag', label: 'new-tag' }),
    expect.objectContaining({ action: 'create-option' }),
  )
})

it.each(['Enter', 'Tab'])('should create hasMany text with a closed menu using %s', async (key) => {
  const onChange = vi.fn()
  const existing = { label: 'existing', value: 'existing' }
  await enterOption({ props: { menuIsOpen: false, value: [existing], onChange }, key })
  expect(onChange).toHaveBeenCalledExactlyOnceWith(
    [existing, expect.objectContaining({ label: 'new-tag', value: 'new-tag' })],
    expect.objectContaining({ action: 'create-option' }),
  )
  expect(container.querySelector('input')!.value).toBe('')
  expect(container.querySelector('[role="listbox"]')).toBeNull()
})

it('should honor custom creation callbacks with a closed menu', async () => {
  const onCreateOption = vi.fn()
  const onChange = vi.fn()
  await enterOption({ props: { menuIsOpen: false, onCreateOption, onChange } })
  expect(onCreateOption).toHaveBeenCalledExactlyOnceWith('new-tag')
  expect(onChange).not.toHaveBeenCalled()
})

it.each([
  { isValidNewOption: () => false },
  { filterOption: () => false },
  { disabled: true },
  {
    options: [{ label: 'Group', options: [{ label: 'existing', value: 'existing' }] }],
    isValidNewOption: () => false,
    filterOption: () => true,
  },
])('should reject creation in a closed menu with %o', async (props) => {
  const onChange = vi.fn()
  await enterOption({ props: { ...props, menuIsOpen: false, onChange } })
  expect(onChange).not.toHaveBeenCalled()
})

it('should honor custom option data with a closed menu', async () => {
  const onChange = vi.fn()
  await enterOption({
    props: {
      menuIsOpen: false,
      onChange,
      getNewOptionData: (value) => ({ label: 'Custom label', value: value.toUpperCase() }),
    },
  })
  expect(onChange).toHaveBeenCalledExactlyOnceWith(
    [{ label: 'Custom label', value: 'NEW-TAG' }],
    expect.objectContaining({ action: 'create-option' }),
  )
})

it('should create a single value with a closed menu', async () => {
  const onChange = vi.fn()
  await enterOption({ props: { menuIsOpen: false, isMulti: false, value: undefined, onChange } })
  expect(onChange).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ label: 'new-tag', value: 'new-tag' }),
    expect.objectContaining({ action: 'create-option' }),
  )
})

it.each([
  { inputValue: '   ' },
  { isComposing: true },
  { props: { value: [{ label: 'new-tag', value: 'new-tag' }] } },
  { props: { options: [{ label: 'new-tag', value: 'new-tag' }] } },
])('should ignore whitespace, composition and duplicates with a closed menu: %o', async (args) => {
  const onChange = vi.fn()
  await enterOption({ ...args, props: { ...args.props, menuIsOpen: false, onChange } })
  expect(onChange).not.toHaveBeenCalled()
})

it('should leave Tab available to exit when no text is pending', async () => {
  const onChange = vi.fn()
  const event = await enterOption({
    props: { menuIsOpen: false, onChange },
    key: 'Tab',
    inputValue: '',
  })
  expect(event.defaultPrevented).toBe(false)
  expect(onChange).not.toHaveBeenCalled()
})
