import type { CollectionConfig } from './types.js'

import { describe, expect, it } from 'vitest'

import { validateUseAsTitle } from './useAsTitle.js'

const makeCollection = ({
  auth,
  virtual = true,
}: {
  auth: CollectionConfig['auth']
  virtual?: boolean | string[]
}): CollectionConfig => ({
  slug: 'users',
  auth,
  admin: { useAsTitle: 'name' },
  fields: [{ name: 'name', type: 'text', virtual }],
})

describe('authenticated title validation (#16142)', () => {
  it.each([true, { loginWithUsername: true }])(
    'should reject an unsearchable virtual title with auth %j',
    (auth) => {
      expect(() => validateUseAsTitle(makeCollection({ auth }))).toThrow('is virtual')
    },
  )
  it.each([false, ['profile', 'name']])(
    'should accept a persisted or relationship-backed title: %j',
    (virtual) => {
      expect(() => validateUseAsTitle(makeCollection({ auth: true, virtual }))).not.toThrow()
    },
  )
  it('should preserve the default implicit email title for auth collections', () => {
    expect(() =>
      validateUseAsTitle({ slug: 'users', auth: true, admin: { useAsTitle: 'email' }, fields: [] }),
    ).not.toThrow()
  })
})
