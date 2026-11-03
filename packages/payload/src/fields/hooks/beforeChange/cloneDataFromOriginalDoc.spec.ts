import { describe, expect, it } from 'vitest'

import { cloneDataFromOriginalDoc } from './cloneDataFromOriginalDoc.js'

describe('original document fallback cloning (#18415)', () => {
  it('should isolate nested field mutations from the original document', () => {
    const original = [{ items: [{ code: 'preserved', group: { label: 'original' } }] }]
    const cloned = cloneDataFromOriginalDoc(original) as typeof original
    delete (cloned[0]!.items[0] as Partial<(typeof original)[0]['items'][0]>).code
    cloned[0]!.items[0]!.group.label = 'changed'
    expect(original[0]!.items[0]).toEqual({ code: 'preserved', group: { label: 'original' } })
  })

  it('should preserve nested JSON array shapes and sparse slots', () => {
    const original = {
      coordinates: [
        [100, 200],
        [300, 400],
      ],
      empty: null,
      rows: new Array(3),
    }
    original.rows[2] = { value: 1 }
    const cloned = cloneDataFromOriginalDoc(original) as typeof original
    expect(cloned).toEqual(original)
    expect(Array.isArray(cloned.coordinates[0])).toBe(true)
    expect(0 in cloned.rows).toBe(false)
    cloned.coordinates[0]![0] = 9
    expect(original.coordinates[0]![0]).toBe(100)
  })
})
