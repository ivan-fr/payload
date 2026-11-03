import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'

function throwFromApplicationJobHandler(): never {
  throw new Error('Application job failure')
}

// Register handlers before sanitization builds the task/workflow enum fields.
export default buildConfigWithDefaults({
  suite: 'queues-handler-stacks',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    typescript: { autoGenerate: false },
    jobs: {
      tasks: [{ slug: 'StackRegression', retries: 0, handler: throwFromApplicationJobHandler }],
      workflows: [
        { slug: 'StackWorkflowRegression', retries: 0, handler: throwFromApplicationJobHandler },
      ],
    },
  },
})
