import { _internal_jobSystemGlobals } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'

function throwFromApplicationJobHandler(): never {
  throw new Error('Application job failure')
}

_internal_jobSystemGlobals.shouldAutoRun = false
_internal_jobSystemGlobals.shouldAutoSchedule = false

test.suite('Persisted job handler stacks (#18055)', { config: './config.ts' }, () => {
  test('should store the task handler frames in both the job and its task log', async ({
    payload,
  }) => {
    const originalTasks = payload.config.jobs.tasks
    payload.config.jobs.tasks = [
      ...(originalTasks || []),
      { slug: 'StackRegression', retries: 0, handler: throwFromApplicationJobHandler },
    ]
    try {
      const job = await payload.jobs.queue({
        overrideAccess: true,
        task: 'StackRegression',
        input: {},
      })
      await payload.jobs.run({ silent: true, overrideAccess: true })
      const result = await payload.findByID({
        collection: 'payload-jobs',
        overrideAccess: true,
        id: job.id,
      })

      expect(result.hasError).toBe(true)
      expect(result.error?.stack).toContain('throwFromApplicationJobHandler')
      expect(result.log?.[0]?.error?.stack).toContain('throwFromApplicationJobHandler')
    } finally {
      payload.config.jobs.tasks = originalTasks
    }
  })

  test('should store workflow handler frames in the persisted job error', async ({ payload }) => {
    const originalWorkflows = payload.config.jobs.workflows
    payload.config.jobs.workflows = [
      ...(originalWorkflows || []),
      { slug: 'StackWorkflowRegression', retries: 0, handler: throwFromApplicationJobHandler },
    ]
    try {
      const job = await payload.jobs.queue({
        overrideAccess: true,
        workflow: 'StackWorkflowRegression',
        input: {},
      })
      await payload.jobs.run({ silent: true, overrideAccess: true })
      const result = await payload.findByID({
        collection: 'payload-jobs',
        overrideAccess: true,
        id: job.id,
      })

      expect(result.hasError).toBe(true)
      expect(result.error?.stack).toContain('throwFromApplicationJobHandler')
    } finally {
      payload.config.jobs.workflows = originalWorkflows
    }
  })
})
