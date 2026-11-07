import { act, StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ActionsProvider, useActions } from './index.js'

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

function View({ name, hasAction = true }: { name: string; hasAction?: boolean }) {
  const { Actions, setViewActions } = useActions()
  useEffect(() => {
    if (hasAction) setViewActions({ custom: <button>{name}</button> })
    return () => setViewActions({})
  }, [hasAction, name, setViewActions])
  return <header>{Object.values(Actions)}</header>
}

it.each([false, true])(
  'should preserve child mount actions (StrictMode: %s) (#19402)',
  async (isStrict) => {
    const tree = (
      <ActionsProvider viewKey="first">
        <View name="Set on mount" />
      </ActionsProvider>
    )
    await act(() => root.render(isStrict ? <StrictMode>{tree}</StrictMode> : tree))
    expect(container.querySelector('button')?.textContent).toBe('Set on mount')
  },
)

it('should preserve new view mount actions and clear stale actions on navigation', async () => {
  await act(() =>
    root.render(
      <ActionsProvider viewKey="first">
        <View key="first" name="First" />
      </ActionsProvider>,
    ),
  )
  await act(() =>
    root.render(
      <ActionsProvider viewKey="second">
        <View key="second" name="Second" />
      </ActionsProvider>,
    ),
  )
  expect(container.textContent).toBe('Second')
  await act(() =>
    root.render(
      <ActionsProvider viewKey="third">
        <View key="third" name="Third" hasAction={false} />
      </ActionsProvider>,
    ),
  )
  expect(container.textContent).toBe('')
})
