import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useIntersect } from './useIntersect.js'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let observers: { callback: IntersectionObserverCallback; target?: Element }[]

function Fixture() {
  const [setNode, entry] = useIntersect()
  return <div ref={setNode}>{entry ? String(entry.isIntersecting) : 'pending'}</div>
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  observers = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback })
        this.record = observers.at(-1)!
      }
      record: (typeof observers)[number]
      observe(target: Element) {
        this.record.target = target
      }
      disconnect() {
        this.record.target = undefined
      }
    },
  )
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('useIntersect batched notifications', () => {
  for (const isIntersecting of [true, false]) {
    it(`should retain the latest visibility (${isIntersecting}) when multiple entries arrive together`, async () => {
      await act(() => root.render(<Fixture />))
      const observer = observers.find(({ target }) => target)!
      const entry = (visible: boolean) =>
        ({ target: observer.target, isIntersecting: visible }) as IntersectionObserverEntry

      await act(() =>
        observer.callback(
          [entry(!isIntersecting), entry(isIntersecting)],
          {} as IntersectionObserver,
        ),
      )

      expect(container.textContent).toBe(String(isIntersecting))
    })
  }
})
