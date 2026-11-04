import type { Config } from './types.js'

import { describe, expect, it } from 'vitest'

import { sanitizeConfig } from './sanitize.js'

describe('searchable field configuration (#14904)', () => {
  it('should fail early for an unknown search field with collection and path context', () => {
    expect(() =>
      sanitizeConfig({
        collections: [
          {
            slug: 'posts',
            admin: { listSearchableFields: ['title', 'typo'] },
            fields: [{ name: 'title', type: 'text' }],
          },
        ],
      } as Config),
    ).toThrow(/posts.*typo|typo.*posts/)
  })

  it('should preserve nested/JSON paths, layout fields, virtual fields and ID aliases', () => {
    const config = sanitizeConfig({
      collections: [
        {
          slug: 'posts',
          admin: {
            listSearchableFields: ['id', '_id', 'title', 'meta.title', 'details.value', 'computed'],
          },
          fields: [
            { type: 'row', fields: [{ name: 'title', type: 'text' }] },
            { name: 'meta', type: 'group', fields: [{ name: 'title', type: 'text' }] },
            { name: 'details', type: 'json' },
            { name: 'computed', type: 'text', virtual: true },
          ],
        },
      ],
    } as Config)
    expect(
      config.collections.find((c) => c.slug === 'posts')!.admin.listSearchableFields,
    ).toHaveLength(6)
  })
})
