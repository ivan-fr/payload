import type { DrizzleAdapter } from './types.js'

import { integer, sqliteTable } from 'drizzle-orm/sqlite-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteOne } from './deleteOne.js'
import { buildFindManyArgs } from './find/buildFindManyArgs.js'
import { buildQuery } from './queries/buildQuery.js'
import { selectDistinct } from './queries/selectDistinct.js'
import { transform } from './transform/read/index.js'

vi.mock('./find/buildFindManyArgs.js', () => ({ buildFindManyArgs: vi.fn(() => ({})) }))
vi.mock('./queries/buildQuery.js', () => ({ buildQuery: vi.fn() }))
vi.mock('./queries/selectDistinct.js', () => ({ selectDistinct: vi.fn() }))
vi.mock('./transform/read/index.js', () => ({ transform: vi.fn(({ data }) => data) }))

describe('deleteOne', () => {
  const table = sqliteTable('preferences', { id: integer('id').primaryKey() })
  let adapter: DrizzleAdapter
  let findFirst: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    findFirst = vi.fn().mockResolvedValue({ id: 1 })
    adapter = {
      deleteWhere: vi.fn(),
      drizzle: { query: { preferences: { findFirst } } },
      payload: {
        collections: { preferences: { config: { flattenedFields: [], slug: 'preferences' } } },
        config: {},
      },
      sessions: {},
      tableNameMap: new Map([['preferences', 'preferences']]),
      tables: { preferences: table },
    } as unknown as DrizzleAdapter
    vi.mocked(buildQuery).mockReturnValue({ joins: [], selectFields: {}, where: undefined })
    vi.mocked(selectDistinct).mockResolvedValue(undefined)
  })

  it('should return null when a joined lookup finds no document', async () => {
    vi.mocked(selectDistinct).mockResolvedValue([])

    const result = await deleteOne.call(adapter, { collection: 'preferences', where: {} })

    expect(result).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
    expect(adapter.deleteWhere).not.toHaveBeenCalled()
  })

  it('should retain the ordinary lookup when no distinct query was needed', async () => {
    const result = await deleteOne.call(adapter, { collection: 'preferences', where: {} })

    expect(result).toEqual({ id: 1 })
    expect(buildFindManyArgs).toHaveBeenCalledOnce()
    expect(adapter.deleteWhere).toHaveBeenCalledOnce()
  })

  it('should accept a matched numeric zero id without replaying the joined filter', async () => {
    vi.mocked(selectDistinct).mockResolvedValue([{ id: 0 }])
    findFirst.mockResolvedValue({ id: 0 })

    await deleteOne.call(adapter, { collection: 'preferences', where: {} })

    expect(buildFindManyArgs).not.toHaveBeenCalled()
    expect(transform).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 0 } }))
    expect(adapter.deleteWhere).toHaveBeenCalledOnce()
  })
})
