import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export function selectE2EMatrix({ matrix, targeted, suites }) {
  if (!targeted) return matrix

  if (
    !Array.isArray(suites) ||
    suites.length === 0 ||
    suites.some((suite) =>
      typeof suite === 'string'
        ? !suite
        : !suite ||
          typeof suite.suite !== 'string' ||
          !suite.suite ||
          !['next', 'tanstack-start'].includes(suite.framework),
    )
  ) {
    throw new Error('Targeted mode requires suite names or { suite, framework } selections')
  }

  const requested = new Set(
    suites.map((suite) =>
      typeof suite === 'string' ? `next:${suite}` : `${suite.framework}:${suite.suite}`,
    ),
  )
  const include = matrix.include.filter(
    (entry) => requested.has(`${entry.framework}:${entry.suite}`) && !entry.disableCacheComponents,
  )
  const found = new Set(include.map((entry) => `${entry.framework}:${entry.suite}`))
  const missing = [...requested].filter((suite) => !found.has(suite))

  if (missing.length) throw new Error(`Unknown targeted E2E suites: ${missing.join(', ')}`)

  return { include }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const matrix = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  const targeted = process.env.TARGETED_E2E === 'true'
  const suites = targeted ? JSON.parse(process.env.TARGETED_E2E_SUITES) : undefined

  process.stdout.write(JSON.stringify(selectE2EMatrix({ matrix, targeted, suites })))
}
