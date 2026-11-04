import type { Field, PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { fieldSchemasToFormState } from './index.js'

describe('form state validation paths (#18873)', () => {
  it('should supply full array, block, named tab and group path segments', async () => {
    const paths: unknown[] = []
    const leaf: Field = {
      name: 'text',
      type: 'text',
      validate: (_value, { path }) => {
        paths.push(path)
        return true
      },
    }
    const fields: Field[] = [
      {
        type: 'tabs',
        tabs: [
          {
            name: 'details',
            fields: [
              { name: 'items', type: 'array', admin: { initCollapsed: false }, fields: [leaf] },
            ],
          },
        ],
      },
      {
        name: 'layout',
        type: 'blocks',
        admin: { initCollapsed: false },
        blocks: [{ slug: 'content', fields: [{ name: 'group', type: 'group', fields: [leaf] }] }],
      },
    ]
    await fieldSchemasToFormState({
      fields,
      schemaPath: 'posts',
      fieldSchemaMap: undefined,
      permissions: {},
      preferences: { fields: {} },
      renderAllFields: false,
      data: {
        details: { items: [{ id: 'row', text: 'array' }] },
        layout: [{ id: 'block', blockType: 'content', group: { text: 'block' } }],
      },
      req: {
        locale: 'en',
        payload: { blocks: {}, config: { localization: false }, logger: { error: vi.fn() } },
        t: (key: string) => key,
      } as unknown as PayloadRequest,
    })
    expect(paths).toContainEqual(['details', 'items', '0', 'text'])
    expect(paths).toContainEqual(['layout', '0', 'group', 'text'])
  })
})
