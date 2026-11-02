import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { discoverE2ESuites } from './discover-e2e-suites.mjs'

test('discovers new nested browser suites without duplicating configured variants or dedicated jobs', () => {
  const testDir = mkdtempSync(path.join(tmpdir(), 'payload-ci-discovery-'))

  try {
    for (const directory of [
      'new-feature/nested',
      'existing',
      'a11y',
      'admin/e2e/visual',
      'node_modules/ignored',
    ]) {
      const folder = path.join(testDir, directory)

      mkdirSync(folder, { recursive: true })
      writeFileSync(path.join(folder, 'e2e.spec.ts'), '')
    }

    assert.deepEqual(
      discoverE2ESuites({ configuredSuites: [{ file: 'existing#custom.config.ts' }], testDir }),
      [{ file: 'new-feature__nested', shards: 1 }],
    )
  } finally {
    rmSync(testDir, { recursive: true, force: true })
  }
})
