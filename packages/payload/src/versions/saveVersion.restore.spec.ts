import type { Payload, SanitizedCollectionConfig, SanitizedGlobalConfig } from '../index.js'

import { describe, expect, it, vi } from 'vitest'

import { saveVersion } from './saveVersion.js'

describe('restore version row timestamps (#17760)', () => {
  it.each(['collection', 'global'] as const)(
    'should stamp a new %s row while preserving the document birth time',
    async (kind) => {
      const createdAt = '2000-01-01T00:00:00.000Z'
      const data = { title: 'Original', createdAt, updatedAt: createdAt }
      const create = vi
        .fn()
        .mockImplementation(async (args) => ({ parent: 'doc', version: args.versionData }))
      const payload = {
        config: {},
        db: { createVersion: create, createGlobalVersion: create },
        logger: { error: vi.fn() },
      } as unknown as Payload
      const entity = { slug: 'posts', versions: false, timestamps: true }

      const result = await saveVersion({
        id: 'doc',
        docWithLocales: data,
        operation: 'restoreVersion',
        payload,
        ...(kind === 'collection'
          ? { collection: entity as SanitizedCollectionConfig }
          : { global: entity as SanitizedGlobalConfig }),
      })
      const written = create.mock.calls[0]![0]

      expect(written.createdAt).toBe(written.updatedAt)
      expect(written.createdAt).not.toBe(createdAt)
      expect(written.versionData.createdAt).toBe(createdAt)
      expect(result.createdAt).toBe(createdAt)
      expect(data.createdAt).toBe(createdAt)
    },
  )
})
