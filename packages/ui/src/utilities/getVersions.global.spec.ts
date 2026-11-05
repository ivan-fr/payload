import type { Payload, SanitizedGlobalConfig } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { getVersions } from './getVersions.js'

const globalConfig = {
  slug: 'settings',
  fields: [],
  versions: { drafts: { autosave: true } },
} as unknown as SanitizedGlobalConfig

describe('published global version state (#17164)', () => {
  for (const status of ['published', 'draft']) {
    it(`should detect a ${status} global behind the current draft projection`, async () => {
      const stored = { _status: status, updatedAt: '2026-11-01T00:00:00.000Z' }
      const payload = {
        config: { localization: false },
        findGlobal: vi.fn(({ select }) =>
          Promise.resolve(
            Object.fromEntries(Object.entries(stored).filter(([key]) => select[key])),
          ),
        ),
        findGlobalVersions: vi.fn().mockResolvedValue({ docs: [{ autosave: true }] }),
        countGlobalVersions: vi.fn().mockResolvedValue({ totalDocs: 2 }),
      } as unknown as Payload
      const result = await getVersions({
        globalConfig,
        payload,
        doc: { _status: 'draft' },
        docPermissions: { fields: true, readVersions: true },
        user: null,
      })

      expect(result.hasPublishedDoc).toBe(status === 'published')
      expect(result.mostRecentVersionIsAutosaved).toBe(true)
      expect(result.unpublishedVersionCount).toBe(2)
      expect(result.versionCount).toBe(2)
    })
  }
})
