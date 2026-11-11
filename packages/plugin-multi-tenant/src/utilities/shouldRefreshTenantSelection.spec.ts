import { expect, it } from 'vitest'

import { shouldRefreshTenantSelection } from './shouldRefreshTenantSelection.js'

it.each([
  { initialValue: undefined, tenantCookie: undefined, expected: false },
  { initialValue: undefined, tenantCookie: 'stale', expected: true },
  { initialValue: 0, tenantCookie: '0', expected: false },
  { initialValue: 1, tenantCookie: '1', expected: false },
  { initialValue: 'a', tenantCookie: 'a', expected: false },
])(
  'should refresh only a stale cookie ($initialValue, $tenantCookie)',
  ({ initialValue, tenantCookie, expected }) => {
    expect(shouldRefreshTenantSelection({ initialValue, tenantCookie })).toBe(expected)
  },
)
