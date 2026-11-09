import type { PayloadRequest } from 'payload'

import { sanitizeFields } from 'payload'
import { expect, it, vi } from 'vitest'

import { fieldSchemasToFormState } from './index.js'
import { renderField } from './renderField.js'

it.each([false, true])(
  'should render missing auth fields while respecting cached disabled fields (cached: %s) (#18162)',
  async (hasCachedField) => {
    const config = { blocks: [], db: { defaultIDType: 'number' }, localization: false } as any
    const fields = sanitizeFields({
      config,
      fields: [{ name: 'email', type: 'email', admin: { description: () => 'Account email' } }],
      validRelationships: [],
    })
    const req = {
      user: null,
      t: (key: string) => key,
      payload: { config, blocks: {}, importMap: {}, logger: { error: vi.fn() } },
    } as unknown as PayloadRequest
    const state = await fieldSchemasToFormState({
      fields,
      data: { email: 'editor@example.com' },
      req,
      schemaPath: 'users',
      permissions: true,
      preferences: {},
      renderAllFields: true,
      mockRSCs: true,
      skipValidation: true,
      clientFieldSchemaMap: new Map(
        hasCachedField
          ? [['users.email', { name: 'email', type: 'email', admin: { disabled: true } }]]
          : [],
      ),
      fieldSchemaMap: new Map([['users.email', fields[0]!]]),
      renderFieldFn: renderField,
    })
    expect(state.email).toMatchObject({ value: 'editor@example.com' })
    expect(state.email!.customComponents?.Description !== undefined).toBe(!hasCachedField)
  },
)
