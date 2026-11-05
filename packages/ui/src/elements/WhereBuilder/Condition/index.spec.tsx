import type { Props } from './index.js'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Condition } from './index.js'

vi.mock('../../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../ReactSelect/index.js', () => ({
  ReactSelect: ({ value, options, onChange }: any) => (
    <select
      aria-label="Operator"
      value={value?.value || ''}
      onChange={(event) => onChange({ value: event.target.value })}
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.value}
        </option>
      ))}
    </select>
  ),
}))
vi.mock('./DefaultFilter/index.js', () => ({ DefaultFilter: () => null }))
vi.mock('../../Button/index.js', () => ({ Button: () => null }))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
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

describe('Condition operator changes', () => {
  for (const value of ['true', 'false']) {
    it(`should clear an exists ${value} when switching to relationship equals`, async () => {
      const updateCondition = vi.fn()
      const props = {
        andIndex: 0,
        orIndex: 0,
        fieldPath: 'authors',
        isFirstCondition: true,
        join: 'and',
        operator: 'exists',
        value,
        reducedFields: [
          {
            fieldPath: 'authors',
            field: { type: 'relationship', name: 'authors', relationTo: 'users' },
            operators: [
              { value: 'exists', label: 'Exists' },
              { value: 'equals', label: 'Equals' },
            ],
          },
        ],
        updateCondition,
      } as unknown as Props
      await act(() => root.render(<Condition {...props} />))
      const select = container.querySelector('.condition__operator select')!
      await act(async () => {
        select.value = 'equals'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })

      expect(updateCondition).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'operator', operator: 'equals', value: undefined }),
      )
    })
  }

  it('should retain a relationship ID between equals and not_equals', async () => {
    const updateCondition = vi.fn()
    const props = {
      andIndex: 0,
      orIndex: 0,
      fieldPath: 'authors',
      isFirstCondition: true,
      join: 'and',
      operator: 'equals',
      value: '123',
      reducedFields: [
        {
          fieldPath: 'authors',
          field: { type: 'relationship', name: 'authors', relationTo: 'users' },
          operators: [
            { value: 'equals', label: 'Equals' },
            { value: 'not_equals', label: 'Not equals' },
          ],
        },
      ],
      updateCondition,
    } as unknown as Props
    await act(() => root.render(<Condition {...props} />))
    const select = container.querySelector('.condition__operator select')!
    await act(async () => {
      select.value = 'not_equals'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(updateCondition).toHaveBeenLastCalledWith(
      expect.objectContaining({ operator: 'not_equals', value: '123' }),
    )
  })
})
