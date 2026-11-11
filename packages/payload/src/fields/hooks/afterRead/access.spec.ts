import type { Field } from '../../config/types.js'
import type { AfterReadArgs } from './index.js'

import { expect, it, vi } from 'vitest'

import { afterRead } from './index.js'

it('should skip hooks on fields denied by read access (#18331)', async () => {
  const hook = vi.fn(() => 'computed')
  const read = vi.fn(() => false)
  const result = await readFields({
    fields: [
      {
        name: 'secret',
        type: 'text',
        access: { read },
        hooks: { afterRead: [hook] },
        defaultValue: 'default',
      },
    ],
    doc: { secret: 'private' },
  })

  expect(result).not.toHaveProperty('secret')
  expect(read).toHaveBeenCalledTimes(1)
  expect(hook).not.toHaveBeenCalled()
})

it.each([{}, { hidden: 'private' }])(
  'should skip hidden hooks even when the stored value is absent: %j',
  async (doc) => {
    const hook = vi.fn(() => 'computed')
    const result = await readFields({
      fields: [
        {
          name: 'hidden',
          type: 'text',
          hidden: true,
          hooks: { afterRead: [hook] },
          defaultValue: 'default',
        },
      ],
      doc,
    })

    expect(result).not.toHaveProperty('hidden')
    expect(hook).not.toHaveBeenCalled()
  },
)

it('should run visible hooks when read access is overridden or hidden fields are requested', async () => {
  const denied = vi.fn(() => 'allowed by override')
  const hidden = vi.fn(() => 'shown')
  const result = await readFields({
    fields: [
      {
        name: 'secret',
        type: 'text',
        access: { read: () => false },
        hooks: { afterRead: [denied] },
      },
      { name: 'hidden', type: 'text', hidden: true, hooks: { afterRead: [hidden] } },
    ],
    doc: { hidden: 'original', secret: 'original' },
    overrideAccess: true,
    showHiddenFields: true,
  })

  expect(result).toEqual({ hidden: 'shown', secret: 'allowed by override' })
  expect(denied).toHaveBeenCalledTimes(1)
  expect(hidden).toHaveBeenCalledTimes(1)
})

it('should not run descendants of an unreadable group', async () => {
  const child = vi.fn(() => 'computed')

  await readFields({
    fields: [
      {
        name: 'group',
        type: 'group',
        access: { read: () => false },
        fields: [{ name: 'child', type: 'text', hooks: { afterRead: [child] } }],
      },
    ],
    doc: { group: { child: 'private' } },
  })

  expect(child).not.toHaveBeenCalled()
})

async function readFields({
  fields,
  doc,
  overrideAccess = false,
  showHiddenFields = false,
}: {
  doc: Record<string, unknown>
  fields: Field[]
  overrideAccess?: boolean
  showHiddenFields?: boolean
}) {
  return afterRead({
    collection: { slug: 'posts', fields },
    context: {},
    depth: 0,
    doc,
    draft: false,
    fallbackLocale: false,
    global: null,
    locale: 'en',
    overrideAccess,
    req: { payload: { config: { defaultDepth: 0, maxDepth: 10 } } },
    showHiddenFields,
  } as AfterReadArgs<typeof doc>)
}
