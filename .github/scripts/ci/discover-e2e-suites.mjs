import path from 'node:path'

import { findSpecFiles } from '../visual/find-visual-suites.mjs'

export function discoverE2ESuites({ configuredSuites, testDir }) {
  const configured = new Set(configuredSuites.map(({ file }) => file.split('#')[0]))
  const suites = new Set()

  for (const spec of findSpecFiles(testDir)) {
    const directory = path.relative(testDir, path.dirname(spec))
    const suite = directory.split(path.sep).join('__')

    // These have dedicated, mandatory jobs with their own browser configuration.
    if (directory.split(path.sep)[0] === 'a11y' || suite === 'admin__e2e__visual') {
      continue
    }

    if (!configured.has(suite)) {
      suites.add(suite)
    }
  }

  return [...suites].sort().map((file) => ({ file, shards: 1 }))
}
