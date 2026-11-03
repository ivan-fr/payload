import type { PayloadRequest } from 'payload'

import { expect } from 'vitest'

import { getPayloadPopulateFn } from '../../packages/richtext-lexical/src/features/converters/utilities/payloadPopulateFn.js'
import { test } from '../__helpers/int/vitest.js'
import { devUser } from '../credentials.js'
import { textCollectionSlug } from './slugs.js'

test.suite('Version diff relationship population', { config: './config.ts' }, () => {
  test('should initialize a renderer request loader and retain constrained document read access', async ({
    payload,
  }) => {
    const user = (
      await payload.find({
        collection: 'users',
        overrideAccess: true,
        where: { email: { equals: devUser.email } },
      })
    ).docs[0]!
    const allowed = await payload.create({
      collection: textCollectionSlug,
      overrideAccess: true,
      data: { text: 'Visible relationship', owner: user.id },
    })
    const other = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: 'diff-owner@example.com', password: 'test' },
    })
    const denied = await payload.create({
      collection: textCollectionSlug,
      overrideAccess: true,
      data: { text: 'Private relationship', owner: other.id },
    })
    // Renderer requests can predate any Local API operation on the original scope.
    const req = { payload, user: { ...user, collection: 'users' }, locale: 'en' } as PayloadRequest
    expect(req.payloadDataLoader).toBeUndefined()
    const populate = await getPayloadPopulateFn({
      currentDepth: 0,
      depth: 1,
      overrideAccess: false,
      req,
    })
    expect(await populate({ collectionSlug: textCollectionSlug, id: allowed.id })).toMatchObject({
      id: allowed.id,
      text: 'Visible relationship',
    })
    expect(await populate({ collectionSlug: textCollectionSlug, id: denied.id })).toBeNull()
  })
})
