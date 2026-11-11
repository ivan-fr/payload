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

  if (typeof retriesConfig === 'number' || !retriesConfig.backoff) {
    return now
  }

  const { backoff } = retriesConfig
  const delay = backoff.delay || 0

  if (!delay) {
    return now
  }
  if (backoff.type === 'fixed') {
    return new Date(now.getTime() + delay)
  }
  if (backoff.type !== 'exponential') {
    return now
  }

  // The current attempt is not included in totalTried.
  const exponentialDelay = Math.pow(2, totalTried) * delay
  const factor = backoff.jitter ? 0.5 + Math.random() * 0.5 : 1

  return new Date(now.getTime() + exponentialDelay * factor)
}
