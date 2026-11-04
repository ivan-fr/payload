import type { FlattenedField } from 'payload'

import { sql } from 'drizzle-orm'
import { geometry, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'

import type { DrizzleAdapter } from '../types.js'

import { buildFindManyArgs } from '../find/buildFindManyArgs.js'
import { upsertRow } from './index.js'

describe('point update response (#17461)', () => {
  it.each([undefined, { location: true }, { title: true, location: true }])(
    'should preserve the GeoJSON projection with select %j',
    async (select) => {
      const table = pgTable('places', { id: integer(), title: text(), location: geometry() })
      const fields = [
        { name: 'title', type: 'text' },
        { name: 'location', type: 'point' },
      ] as FlattenedField[]
      const adapter = {
        name: 'postgres',
        tables: { places: table },
        tableNameMap: new Map(),
        payload: { config: { localization: false } },
      } as unknown as DrizzleAdapter
      const args = buildFindManyArgs({
        adapter,
        depth: 0,
        fields,
        joinQuery: false,
        select,
        tableName: 'places',
      })
      expect(args.extras).toHaveProperty('location')
      const findFirst = vi.fn(async () => ({
        id: 1,
        title: 'Updated',
        location: { type: 'Point', coordinates: [10, 20] },
      }))
      const returning = vi.fn(async () => [{ id: 1, title: 'Updated' }])
      const db = {
        update: () => ({ set: () => ({ where: () => ({ returning }) }) }),
        query: { places: { findFirst } },
      }
      const doc = await upsertRow({
        adapter,
        collectionSlug: 'places',
        data: { title: 'Updated' },
        db: db as never,
        fields,
        id: 1,
        operation: 'update',
        select,
        tableName: 'places',
      })
      expect(doc!.location).toEqual({ type: 'Point', coordinates: [10, 20] })
      expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ extras: args.extras }))
      expect(returning).toHaveBeenCalledWith({ id: table.id })
      expect(args.extras!.location).toEqual(
        sql.raw('ST_AsGeoJSON("location")::jsonb').as('location'),
      )
    },
  )
})
