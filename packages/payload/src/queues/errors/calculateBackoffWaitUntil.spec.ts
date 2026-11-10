import { afterEach, describe, expect, it, vi } from 'vitest'

import { _internal_jobSystemGlobals } from '../utilities/getCurrentDate.js'
import { calculateBackoffWaitUntil } from './calculateBackoffWaitUntil.js'

afterEach(() => vi.restoreAllMocks())

describe('exponential backoff jitter (#16318)', () => {
  const now = new Date('2026-11-10T00:00:00.000Z')
  it.each([0, 0.5, 0.999])('should spread exponential retries for random sample %s', (sample) => {
    vi.spyOn(_internal_jobSystemGlobals, 'getCurrentDate').mockReturnValue(now)
    vi.spyOn(Math, 'random').mockReturnValue(sample)
    const result = calculateBackoffWaitUntil({
      retriesConfig: { attempts: 5, backoff: { type: 'exponential', delay: 1000, jitter: true } },
      totalTried: 3,
    })

    expect(result.getTime() - now.getTime()).toBe(Math.floor(8000 * (0.5 + sample * 0.5)))
  })

  it.each(['fixed', 'exponential'] as const)(
    'should retain deterministic %s retries by default',
    (type) => {
      vi.spyOn(_internal_jobSystemGlobals, 'getCurrentDate').mockReturnValue(now)
      const random = vi.spyOn(Math, 'random')
      const result = calculateBackoffWaitUntil({
        retriesConfig: { attempts: 5, backoff: { type, delay: 1000 } },
        totalTried: 3,
      })

      expect(result.getTime() - now.getTime()).toBe(type === 'fixed' ? 1000 : 8000)
      expect(random).not.toHaveBeenCalled()
    },
  )

  it('should keep fixed backoff unaffected when jitter is enabled', () => {
    vi.spyOn(_internal_jobSystemGlobals, 'getCurrentDate').mockReturnValue(now)
    const random = vi.spyOn(Math, 'random')

    expect(
      calculateBackoffWaitUntil({
        retriesConfig: { attempts: 5, backoff: { type: 'fixed', delay: 1000, jitter: true } },
        totalTried: 3,
      }).getTime() - now.getTime(),
    ).toBe(1000)
    expect(random).not.toHaveBeenCalled()
  })
})
