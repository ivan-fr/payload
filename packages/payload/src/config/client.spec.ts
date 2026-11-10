import type { I18nClient } from '@payloadcms/translations'

import type { SanitizedConfig } from './types.js'

import { describe, expect, it } from 'vitest'

import { createClientField } from '../fields/config/client.js'
import { createClientConfig } from './client.js'

describe('createClientConfig', () => {
  it('should omit baseAccess from the client config', () => {
    const clientConfig = createClientConfig({
      config: {
        baseAccess: {
          collections: {
            read: () => true,
          },
        },
      } as SanitizedConfig,
      i18n: {} as I18nClient,
      importMap: {},
      user: true,
    })

    expect(clientConfig).not.toHaveProperty('baseAccess')
  })
})

it('should serialize a collapsible preference opt-out to the client (#16952)', () => {
  const field = createClientField({
    defaultIDType: 'number',
    field: {
      type: 'collapsible',
      label: 'Details',
      fields: [],
      admin: { initCollapsed: false, persistCollapsedState: false },
    },
    i18n: {} as I18nClient,
    importMap: {},
  })
  expect(JSON.parse(JSON.stringify(field))).toMatchObject({
    admin: { initCollapsed: false, persistCollapsedState: false },
  })
})
