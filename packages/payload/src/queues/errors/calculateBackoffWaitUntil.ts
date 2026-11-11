import type { RetryConfig } from '../config/types/taskTypes.js'

import { getCurrentDate } from '../utilities/getCurrentDate.js'

export function calculateBackoffWaitUntil({
  retriesConfig,
  totalTried,
}: {
  retriesConfig: number | RetryConfig
  totalTried: number
}): Date {
  const now = getCurrentDate()
  let waitUntil: Date = now

  if (typeof retriesConfig === 'object') {
    if (retriesConfig.backoff) {
      if (retriesConfig.backoff.type === 'fixed') {
        waitUntil = retriesConfig.backoff.delay
          ? new Date(now.getTime() + retriesConfig.backoff.delay)
          : now
      } else if (retriesConfig.backoff.type === 'exponential') {
        // 2 ^ (attempts - 1) * delay (current attempt is not included in totalTried, thus no need for -1)
        const delay = retriesConfig.backoff.delay ? retriesConfig.backoff.delay : 0
        const exponentialDelay = Math.pow(2, totalTried) * delay
        // Equal jitter: keep at least half of the exponential delay so the growth curve is preserved,
        // and randomize the rest so jobs that failed together do not all retry at the same instant.
        const retryDelay = retriesConfig.backoff.jitter
          ? exponentialDelay / 2 + Math.random() * (exponentialDelay / 2)
          : exponentialDelay
        waitUntil = new Date(now.getTime() + retryDelay)
      }
    }
  }

  return waitUntil
}
