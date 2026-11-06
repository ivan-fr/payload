import type { Field, PayloadRequest } from 'payload'

import { sanitizeFields } from 'payload'
import { reduceFieldsToValues } from 'payload/shared'
import { describe, expect, it, vi } from 'vitest'

import { fieldSchemasToFormState } from './index.js'

const build = async ({
  fields,
  data,
  blocks = {},
}: {
  fields: Field[]
  data: object
  blocks?: Record<string, any>
}) => {
  const config = { blocks: Object.values(blocks), localization: false } as any
  for (const block of Object.values(blocks)) {
    block.fields = sanitizeFields({ config, fields: block.fields, validRelationships: [] })
  }
  const sanitized = sanitizeFields({ config, fields, validRelationships: [] })
  const req = {
    locale: 'en',
    user: null,
    t: (key: string) => key,
    payload: { config, blocks, logger: { error: vi.fn() } },
  } as unknown as PayloadRequest
  return fieldSchemasToFormState({
    fields: sanitized,
    data,
    req,
    schemaPath: 'pages',
    permissions: true,
    preferences: {},
    renderAllFields: true,
    fieldSchemaMap: undefined,
    skipValidation: true,
  })
}
const createTabs = (): Field => ({
  type: 'tabs',
  tabs: [
    { label: 'Main', fields: [{ name: 'showExtra', type: 'checkbox' }] },
    {
      name: 'extra',
      admin: { condition: (_data, siblingData) => Boolean(siblingData.showExtra) },
      fields: [{ name: 'title', type: 'text' }],
    },
  ],
})

describe('conditional tabs form state (#18452)', () => {
  it('should omit root visibility metadata from submission', async () => {
    const state = await build({
      fields: [{ name: 'title', type: 'text' }, createTabs()],
      data: { title: 'Hello', showExtra: true, extra: { title: 'Extra' } },
    })
    const data = JSON.parse(JSON.stringify(reduceFieldsToValues(state, true)))

    expect(data).toEqual({ title: 'Hello', showExtra: true, extra: { title: 'Extra' } })
  })

  it('should isolate conditional tabs for repeated inline block rows', async () => {
    const state = await build({
      fields: [
        { name: 'layout', type: 'blocks', blocks: [{ slug: 'section', fields: [createTabs()] }] },
      ],
      data: {
        layout: [
          { id: 'row-a', blockType: 'section', showExtra: false },
          { id: 'row-b', blockType: 'section', showExtra: true, extra: { title: 'Second only' } },
        ],
      },
    })

    expect(state['layout.0.extra']).toMatchObject({ disableFormData: true, passesCondition: false })
    expect(state['layout.1.extra']).toMatchObject({ disableFormData: true, passesCondition: true })
    const data = JSON.parse(JSON.stringify(reduceFieldsToValues(state, true)))
    expect(Object.keys(data)).toEqual(['layout'])
    expect(data.layout[1].extra).toEqual({ title: 'Second only' })
  })
  it('should isolate referenced block tabs and omit their schema IDs from submitted data', async () => {
    const state = await build({
      fields: [{ name: 'layout', type: 'blocks', blocks: ['section'] }],
      blocks: { section: { slug: 'section', fields: [createTabs()] } },
      data: {
        layout: [
          { id: 'row-a', blockType: 'section', showExtra: false },
          { id: 'row-b', blockType: 'section', showExtra: true, extra: { title: 'Referenced' } },
        ],
      },
    })
    expect(state['layout.0.extra']).toMatchObject({ disableFormData: true, passesCondition: false })
    expect(state['layout.1.extra']).toMatchObject({ disableFormData: true, passesCondition: true })
    const data = JSON.parse(JSON.stringify(reduceFieldsToValues(state, true)))
    expect(Object.keys(data)).toEqual(['layout'])
    expect(data.layout[1].extra).toEqual({ title: 'Referenced' })
  })

  it('should isolate unnamed conditional tabs within array rows', async () => {
    const state = await build({
      fields: [
        {
          name: 'rows',
          type: 'array',
          fields: [
            {
              type: 'tabs',
              tabs: [
                { label: 'Main', fields: [{ name: 'showExtra', type: 'checkbox' }] },
                {
                  label: 'Extra',
                  admin: { condition: (_data, siblingData) => Boolean(siblingData.showExtra) },
                  fields: [{ name: 'note', type: 'text' }],
                },
              ],
            },
          ],
        },
      ],
      data: {
        rows: [
          { id: 'a', showExtra: false },
          { id: 'b', showExtra: true, note: 'Visible' },
        ],
      },
    })
    expect(state['rows.0._index-0-1']).toMatchObject({
      disableFormData: true,
      passesCondition: false,
    })
    expect(state['rows.1._index-0-1']).toMatchObject({
      disableFormData: true,
      passesCondition: true,
    })
    const data = JSON.parse(JSON.stringify(reduceFieldsToValues(state, true)))
    expect(Object.keys(data)).toEqual(['rows'])
    expect(data.rows[1].note).toBe('Visible')
  })
})
