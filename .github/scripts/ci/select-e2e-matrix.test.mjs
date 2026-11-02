import assert from 'node:assert/strict'
import test from 'node:test'

import { selectE2EMatrix } from './select-e2e-matrix.mjs'

const matrix = {
  include: [
    { suite: 'auth', framework: 'next', shard: 1 },
    { suite: 'auth', framework: 'next', shard: 2 },
    { suite: 'auth', framework: 'tanstack-start', shard: 1 },
    { suite: 'auth', framework: 'next', disableCacheComponents: true },
    { suite: 'other', framework: 'next', shard: 1 },
  ],
}

test('full runs preserve every matrix entry', () => {
  assert.equal(selectE2EMatrix({ matrix, targeted: false }), matrix)
})

test('targeted runs preserve all shards only for requested failed Next.js suites', () => {
  assert.deepEqual(selectE2EMatrix({ matrix, targeted: true, suites: ['auth'] }), {
    include: matrix.include.slice(0, 2),
  })
})

for (const suites of [[], null, ['missing'], ['auth', 'missing'], [''], [12]]) {
  test(`rejects invalid targeted suites: ${JSON.stringify(suites)}`, () => {
    assert.throws(() => selectE2EMatrix({ matrix, targeted: true, suites }))
  })
}
