import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'

test.suite(
  'Persisted job handler stacks (#18055)',
  { config: './config.handler-stacks.ts', cron: false },
  () => {
    test('should store the task handler frames in both the job and its task log', async ({
      payload,
    }) => {
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
    })

    test('should store workflow handler frames in the persisted job error', async ({ payload }) => {
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
    })
  },
)
