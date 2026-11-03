import type { SanitizedConfig } from 'payload'

import { describe, expect, it } from 'vitest'

import { buildPoliciesType } from './buildPoliciesType.js'

describe('global policy type names', () => {
  it('should use the configured GraphQL name for a global access type', () => {
    const config = {
      collections: [],
      globals: [{ slug: 'settings', fields: [], graphQL: { name: 'SiteSettings' } }],
    } as unknown as SanitizedConfig
    const fields = buildPoliciesType(config).getFields()

    expect(String(fields.settings.type)).toBe('SiteSettingsAccess')
  })

  it('should fall back to the global slug when no GraphQL name is set', () => {
    const config = {
      collections: [],
      globals: [{ slug: 'settings', fields: [] }],
    } as unknown as SanitizedConfig

    expect(String(buildPoliciesType(config).getFields().settings.type)).toBe('settingsAccess')
  })
})
