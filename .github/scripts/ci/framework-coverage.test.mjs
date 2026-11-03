import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

test('all shared suites remain blocking on both frameworks; Next config suites stay on Next', () => {
  const { include } = JSON.parse(
    execFileSync(process.execPath, ['.github/workflows/e2e.config.ts'], { encoding: 'utf8' }),
  )
  const nextOnly = new Set(['base-path', 'trailing-slash'])
  const shared = include.filter(
    (entry) =>
      entry.framework === 'next' && !entry.disableCacheComponents && !nextOnly.has(entry.suite),
  )
  const tanstack = include.filter((entry) => entry.framework === 'tanstack-start')

  assert.ok(shared.length > 0)
  assert.equal(tanstack.length, shared.length)
  for (const entry of shared) {
    assert.ok(tanstack.some((other) => other.suite === entry.suite && other.shard === entry.shard))
  }
  for (const suite of nextOnly) {
    assert.ok(
      include.some(
        (entry) => entry.suite === suite && entry.framework === 'next' && !entry.optional,
      ),
    )
    assert.ok(!tanstack.some((entry) => entry.suite === suite))
  }
  assert.ok(include.every((entry) => !entry.optional))
  assert.ok(include.length <= 256)
})
