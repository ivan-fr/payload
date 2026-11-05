import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { updateOperation } from '../../packages/payload/src/globals/operations/update.js'
import { getVersions } from '../../packages/ui/src/utilities/getVersions.js'
import { test } from '../__helpers/int/vitest.js'
import { settingsSlug, usersSlug } from './slugs.js'

test.suite('published global status (#17164)', { config: './config.ts' }, () => {
  for (const hasPublished of [true, false]) {
    test(`should report hasPublishedDoc=${hasPublished} beneath an autosave`, async ({
      payload,
    }) => {
      const user = await payload.create({
        collection: usersSlug,
        overrideAccess: true,
        data: { email: 'editor@example.com', password: 'password123' },
      })
      if (hasPublished)
        await payload.updateGlobal({
          slug: settingsSlug,
          overrideAccess: true,
          data: { title: 'Published', _status: 'published' },
        })
      const globalConfig = payload.globals.config.find(({ slug }) => slug === settingsSlug)!
      const req = await createPayloadRequest({ payload, user: { ...user, collection: usersSlug } })
      const doc = await updateOperation({
        slug: settingsSlug,
        globalConfig,
        req,
        overrideAccess: false,
        draft: true,
        autosave: true,
        data: { title: 'Changed', _status: 'draft' },
      })
      const result = await getVersions({
        globalConfig,
        payload,
        doc,
        docPermissions: { fields: true, readVersions: true },
        user: { ...user, collection: usersSlug },
      })

      expect(result.hasPublishedDoc).toBe(hasPublished)
      expect(result.mostRecentVersionIsAutosaved).toBe(true)
    })
  }
})
