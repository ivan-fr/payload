import type { Job, PayloadRequest, WorkflowConfig } from '../../index.js'

import { describe, expect, it, vi } from 'vitest'

import { getRunTaskFunction } from '../operations/runJobs/runJob/getRunTaskFunction.js'
import { runJob } from '../operations/runJobs/runJob/index.js'
import { runJSONJob } from '../operations/runJobs/runJSONJob/index.js'
import { JobCancelledError, JobRunAbortedError, TaskError, WorkflowError } from './index.js'

function throwFromApplicationHandler() {
  throw new Error('Application handler failed')
}

function fixture() {
  return {
    job: { id: 'job', taskStatus: {}, totalTried: 0, workflowSlug: 'workflow' } as unknown as Job,
    req: {
      payload: { config: { jobs: { tasks: [] } }, logger: { error: vi.fn() } },
    } as unknown as PayloadRequest,
    workflowConfig: { slug: 'workflow' } as WorkflowConfig,
    updateJob: vi.fn().mockResolvedValue(undefined),
  }
}

describe('job handler stack preservation (#18055)', () => {
  it('should retain task cause and original handler frames', async () => {
    const { job, req, workflowConfig, updateJob } = fixture()
    const inlineTask = getRunTaskFunction(job, workflowConfig, req, true, updateJob)
    const error = await inlineTask('task', { task: throwFromApplicationHandler }).catch(
      (error: unknown) => error,
    )

    expect(error).toBeInstanceOf(TaskError)
    expect((error as TaskError).cause).toBeInstanceOf(Error)
    expect((error as TaskError).stack).toContain('throwFromApplicationHandler')
  })

  it.each(['task', 'workflow', 'json'] as const)(
    'should persist original frames for %s failures',
    async (kind) => {
      const args = fixture()
      if (kind === 'json') {
        await runJSONJob({
          ...args,
          silent: true,
          workflowHandler: [{ id: 'task', inlineTask: throwFromApplicationHandler }],
        })
      } else {
        await runJob({
          ...args,
          silent: true,
          workflowHandler:
            kind === 'workflow'
              ? throwFromApplicationHandler
              : async ({ inlineTask }) => {
                  await inlineTask('task', { task: throwFromApplicationHandler })
                },
        })
      }

      const update = args.updateJob.mock.calls.at(-1)?.[0]
      expect(update.error.stack).toContain('throwFromApplicationHandler')
      expect(update.error.message).toBe('Application handler failed')
      if (kind === 'task')
        expect(update.log.$push.error.stack).toContain('throwFromApplicationHandler')
    },
  )

  it.each([null, 'plain failure'])('should wrap non-Error throws safely: %j', async (thrown) => {
    const { job, req, workflowConfig, updateJob } = fixture()
    const inlineTask = getRunTaskFunction(job, workflowConfig, req, true, updateJob)
    const error = await inlineTask('task', {
      task: () => {
        throw thrown
      },
    }).catch((error: unknown) => error)

    expect(error).toBeInstanceOf(TaskError)
    expect((error as TaskError).message).toBe('Task handler threw an error')
    expect((error as TaskError).cause).toBe(thrown)
  })

  it.each([new JobCancelledError('cancelled'), new JobRunAbortedError('ownership lost')])(
    'should preserve cancellation and ownership signals',
    async (signal) => {
      const args = fixture()
      await expect(
        runJob({
          ...args,
          workflowHandler: () => {
            throw signal
          },
        }),
      ).rejects.toBe(signal)
      expect(args.updateJob).not.toHaveBeenCalled()
    },
  )

  it('should keep a useful wrapper stack when there is no original error', () => {
    const args = fixture()
    const error = new WorkflowError({
      job: args.job,
      workflowConfig: args.workflowConfig,
      message: 'No cause',
    })
    expect(error.stack).toContain('No cause')
  })
})
