import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { checkRequiredJobs } from './required-jobs.mjs'

test('accepts only an entirely successful required-job set', () => {
  assert.doesNotThrow(() =>
    checkRequiredJobs({ results: { build: { result: 'success' }, unit: { result: 'success' } } }),
  )
})

for (const result of ['failure', 'cancelled', 'skipped', 'neutral', undefined]) {
  test(`rejects a ${String(result)} required job even when other jobs succeed`, () => {
    assert.throws(
      () =>
        checkRequiredJobs({ results: { build: { result: 'success' }, integration: { result } } }),
      /integration:/,
    )
  })
}

for (const results of [null, {}, [], 'success']) {
  test(`rejects invalid or empty results: ${JSON.stringify(results)}`, () => {
    assert.throws(() => checkRequiredJobs({ results }), /missing or invalid/)
  })
}

test('the CLI fails closed on malformed JSON', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./required-jobs.mjs', import.meta.url))],
    {
      encoding: 'utf8',
      env: { ...process.env, REQUIRED_JOB_RESULTS: '{invalid' },
    },
  )

  assert.equal(result.status, 1)
})
