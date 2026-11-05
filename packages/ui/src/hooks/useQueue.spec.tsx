import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useQueue } from './useQueue.js'

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
let queueTask: ReturnType<typeof useQueue>['queueTask']
function Fixture() {
  ;({ queueTask } = useQueue())
  return null
}
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root.render(<Fixture />))
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('queue task lifecycle (#18348)', () => {
  it('should bracket each task with its own processing callbacks and discard superseded work', async () => {
    const first = deferred()
    const second = deferred()
    const events: string[] = []
    let isProcessing = false
    const options = (name: string) => ({
      beforeProcess: () => {
        isProcessing = true
        events.push(`before ${name}`)
      },
      afterProcess: () => {
        isProcessing = false
        events.push(`after ${name}`)
      },
    })
    queueTask(async () => {
      events.push('first')
      await first.promise
    }, options('first'))
    queueTask(async () => {
      events.push('discarded')
    }, options('discarded'))
    queueTask(async () => {
      events.push('second')
      expect(isProcessing).toBe(true)
      await second.promise
    }, options('second'))
    await act(() => first.resolve())
    expect(events).toEqual(['before first', 'first', 'after first', 'before second', 'second'])
    expect(isProcessing).toBe(true)
    await act(() => second.resolve())
    expect(events.at(-1)).toBe('after second')
    expect(isProcessing).toBe(false)
  })

  it('should recheck each task guard before starting pending work', async () => {
    const first = deferred()
    const blocked = vi.fn(async () => {})
    queueTask(() => first.promise)
    queueTask(blocked, { beforeProcess: () => false })
    await act(() => first.resolve())
    expect(blocked).not.toHaveBeenCalled()
    const next = vi.fn(async () => {})
    queueTask(next)
    await act(async () => {})
    expect(next).toHaveBeenCalledOnce()
  })
  it('should release processing after a rejected task and drain pending work', async () => {
    const error = new Error('Save failed')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const after = vi.fn()
    const next = vi.fn(async () => {})
    queueTask(
      async () => {
        throw error
      },
      { afterProcess: after },
    )
    queueTask(next)
    await act(async () => {})
    expect(log).toHaveBeenCalledWith('Error in queued function:', error)
    expect(after).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledOnce()
  })
})
