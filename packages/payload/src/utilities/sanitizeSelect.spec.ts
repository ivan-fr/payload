import { describe, expect, it } from 'vitest'

import type { FlattenedField } from '../fields/config/types.js'
import type { SelectType } from '../types/index.js'

import { sanitizeSelect } from './sanitizeSelect.js'

const authorFields = [
  { name: 'name', type: 'text' },
  { name: 'organization', type: 'relationship', relationTo: 'organizations' },
  { name: 'organizationName', type: 'text', virtual: 'organization.name' },
] as unknown as FlattenedField[]

const authorVersionFields = [
  { name: 'parent', type: 'relationship', relationTo: 'authors' },
  { name: 'version', type: 'group', flattenedFields: authorFields },
] as unknown as FlattenedField[]

describe('sanitizeSelect', () => {
  it('should add the relationship a selected virtual field reads from', () => {
    expect(sanitizeSelect({ fields: authorFields, select: { organizationName: true } })).toEqual({
      organization: true,
      organizationName: true,
    })
  })

  it('should not mutate the select it receives (#13089)', () => {
    const select: SelectType = { organizationName: true }
    const serializedSelect = JSON.stringify(select)

    const sanitizedSelect = sanitizeSelect({ fields: authorFields, select })

    expect(JSON.stringify(select)).toBe(serializedSelect)
    expect(sanitizedSelect).not.toBe(select)
  })

  it('should add the relationship inside an already selected version group', () => {
    const select: SelectType = { version: { name: true, organizationName: true } }

    expect(sanitizeSelect({ fields: authorVersionFields, select, versions: true })).toEqual({
      version: { name: true, organization: true, organizationName: true },
    })
    expect(select).toEqual({ version: { name: true, organizationName: true } })
  })

  it('should keep a fully selected version group as it is', () => {
    expect(
      sanitizeSelect({ fields: authorVersionFields, select: { version: true }, versions: true }),
    ).toEqual({ version: true })
  })

  it('should return the same select when there is nothing to add', () => {
    const includeSelect: SelectType = { name: true }
    const excludeSelect: SelectType = { organizationName: false }

    expect(sanitizeSelect({ fields: authorFields, select: includeSelect })).toBe(includeSelect)
    expect(sanitizeSelect({ fields: authorFields, select: excludeSelect })).toBe(excludeSelect)
    expect(sanitizeSelect({ fields: authorFields, select: undefined })).toBeUndefined()
  })
})
