import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export function selectE2EMatrix({ matrix, targeted, suites }) {
  if (!targeted) return matrix

  if (
    !Array.isArray(suites) ||
    suites.length === 0 ||
    suites.some((suite) => typeof suite !== 'string' || !suite)
  ) {
    throw new Error('Targeted mode requires a non-empty JSON array of suite names')
  }

  const requested = new Set(suites)
  const include = matrix.include.filter(
    (entry) =>
      requested.has(entry.suite) && entry.framework === 'next' && !entry.disableCacheComponents,
  )
  const found = new Set(include.map((entry) => entry.suite))
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
