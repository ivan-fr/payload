import { describe, expect, it } from 'vitest'

import { ensureUniqueBreadcrumbIDs } from './ensureUniqueBreadcrumbIDs.js'

describe('locale-owned breadcrumb row IDs (#16054)', () => {
  it('should clear only IDs owned by another locale while preserving custom breadcrumb data', async () => {
    const value = [
      { id: 'english', doc: 'a', label: 'French', extra: 'kept' },
      { id: 'french', doc: 'b' },
    ]
    const result = await ensureUniqueBreadcrumbIDs({
      value,
      field: { name: 'breadcrumbs', localized: true },
      req: { locale: 'fr' },
      siblingDocWithLocales: { breadcrumbs: { en: [{ id: 'english' }], fr: [{ id: 'french' }] } },
    } as never)

    expect(result).toEqual([
      { doc: 'a', label: 'French', extra: 'kept' },
      { id: 'french', doc: 'b' },
    ])
    expect(value[0]?.id).toBe('english')
  })

  it('should retain row IDs when the field is configured without localization', async () => {
    const value = [{ id: 'kept', doc: 'a' }]
    const result = await ensureUniqueBreadcrumbIDs({
      value,
      field: { name: 'breadcrumbs', localized: false },
      req: { locale: 'fr' },
      siblingDocWithLocales: { breadcrumbs: value },
    } as never)

    expect(result).toBe(value)
  })
})
