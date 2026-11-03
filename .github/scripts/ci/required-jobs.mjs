import { pathToFileURL } from 'node:url'

export function checkRequiredJobs({ results }) {
  if (
    !results ||
    typeof results !== 'object' ||
    Array.isArray(results) ||
    !Object.keys(results).length
  ) {
    throw new Error('Required-job results are missing or invalid.')
  }

  const incomplete = Object.entries(results)
    .filter(([, job]) => job?.result !== 'success')
    .map(([name, job]) => `${name}: ${job?.result ?? 'missing'}`)

  if (incomplete.length) {
    throw new Error(`Required tests did not all succeed:\n${incomplete.join('\n')}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkRequiredJobs({ results: JSON.parse(process.env.REQUIRED_JOB_RESULTS ?? 'null') })
    console.log('Every required Payload 4 job succeeded.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
