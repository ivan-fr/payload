import { describe, expect, it } from 'vitest'

import { mergeCollapsedRows } from './mergeCollapsedRows.js'

describe('collapsed rows across locales (#18843)', () => {
  it('should preserve German rows while replacing only the English collapsed state', () => {
    const previous = ['de-one', 'de-two', 'en-one']
    const merged = mergeCollapsedRows({
      previousCollapsedIDs: previous,
      currentRowIDs: ['en-one', 'en-two'],
      collapsedIDs: ['en-two'],
    })
    expect(merged).toEqual(['de-one', 'de-two', 'en-two'])
    expect(
      mergeCollapsedRows({
        previousCollapsedIDs: merged,
        currentRowIDs: ['de-one', 'de-two'],
        collapsedIDs: [],
      }),
    ).toEqual(['en-two'])
    expect(previous).toEqual(['de-one', 'de-two', 'en-one'])
  })
  it('should collapse all current rows without duplicate IDs', () => {
    expect(
      mergeCollapsedRows({
        previousCollapsedIDs: ['other', 'other', 'current'],
        currentRowIDs: ['current', 'new'],
        collapsedIDs: ['current', 'new'],
      }),
    ).toEqual(['other', 'current', 'new'])
  })
  it('should support absent preferences, empty current rows and nested field paths', () => {
    expect(mergeCollapsedRows({ currentRowIDs: [], collapsedIDs: [] })).toEqual([])
    expect(
      mergeCollapsedRows({
        previousCollapsedIDs: ['other-locale-child'],
        currentRowIDs: [],
        collapsedIDs: [],
      }),
    ).toEqual(['other-locale-child'])
  })
})
