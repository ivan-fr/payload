import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateBackoffWaitUntil } from './calculateBackoffWaitUntil.js'

const now = new Date('2026-01-01T00:00:00.000Z')

const getDelay = ({
  jitter,
  totalTried,
  type = 'exponential',
}: {
  jitter?: boolean
  totalTried: number
  type?: 'exponential' | 'fixed'
}) =>
  calculateBackoffWaitUntil({
    retriesConfig: { attempts: 5, backoff: { type, delay: 1000, jitter } },
    totalTried,
  }).getTime() - now.getTime()

describe('calculateBackoffWaitUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should keep the exponential delay deterministic when jitter is not enabled', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)

    expect([0, 1, 2, 3].map((totalTried) => getDelay({ totalTried }))).toEqual([
      1000, 2000, 4000, 8000,
    ])
    expect(random).not.toHaveBeenCalled()
  })

  it('should spread a jittered exponential delay between half and all of the exponential delay', () => {
    const random = vi.spyOn(Math, 'random')

    random.mockReturnValue(0)
    expect(getDelay({ jitter: true, totalTried: 2 })).toBe(2000)

    random.mockReturnValue(0.5)
    expect(getDelay({ jitter: true, totalTried: 2 })).toBe(3000)

    random.mockReturnValue(0.999999)
    expect(getDelay({ jitter: true, totalTried: 2 })).toBeLessThan(4000)
    expect(getDelay({ jitter: true, totalTried: 2 })).toBeGreaterThanOrEqual(3999)
  })

  it('should give jobs that failed together different retry times when jitter is enabled', () => {
    const delays = new Set(
      Array.from({ length: 20 }, () => getDelay({ jitter: true, totalTried: 3 })),
    )

    expect(delays.size).toBeGreaterThan(1)
  })

  it('should not apply jitter to the fixed strategy', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(getDelay({ jitter: true, totalTried: 3, type: 'fixed' })).toBe(1000)
    expect(random).not.toHaveBeenCalled()
  })
})
