import type { PayloadRequest } from '../types/index.js'

import { describe, expect, it } from 'vitest'

import { getDefaultValue } from './getDefaultValue.js'

describe('array default isolation (#11871)', () => {
  it.each([false, true])(
    'should clone callback defaults before row hooks mutate them (async: %s)',
    async (isAsync) => {
      const sharedRow = { label: 'Default' }
      const rows = Array(4).fill(sharedRow)
      const defaults = isAsync ? async () => rows : () => rows
      const args = { defaultValue: defaults, locale: 'en', req: {} as PayloadRequest, user: null }
      const first = (await getDefaultValue(args)) as { id?: string; label: string }[]

      first.forEach((row, index) => {
        row.id = String(index)
      })
      const second = await getDefaultValue(args)

      expect(first.map(({ id }) => id)).toEqual(['0', '1', '2', '3'])
      expect(second).toEqual(Array(4).fill({ label: 'Default' }))
      expect(sharedRow).toEqual({ label: 'Default' })
    },
  )
})
