import { expect, vi } from 'vitest'

import { test } from '../__helpers/int/vitest.js'

vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_offline')
test.afterAll(() => vi.unstubAllEnvs())

test.suite('Variant duplicate draft validation (#19020)', { config: './config.ts' }, () => {
  test('should publish a combination freed by a sibling draft and reject its occupied draft combination', async ({
    payload,
  }) => {
    const types = await payload.find({
      collection: 'variantTypes',
      overrideAccess: true,
      depth: 0,
      limit: 1,
    })
    const type = types.docs[0]!
    const options = await payload.find({
      collection: 'variantOptions',
      where: { variantType: { equals: type.id } },
      overrideAccess: true,
      depth: 0,
      limit: 2,
    })
    const [small, large] = options.docs
    expect(options.docs).toHaveLength(2)
    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Draft duplicate regression',
        enableVariants: true,
        variantTypes: [type.id],
        _status: 'published',
      },
      overrideAccess: true,
    })
    const first = await payload.create({
      collection: 'variants',
      data: { product: product.id, options: [small!.id], _status: 'published' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'variants',
      id: first.id,
      data: { options: [large!.id] },
      draft: true,
      overrideAccess: true,
    })
    const second = await payload.create({
      collection: 'variants',
      data: { product: product.id, options: [small!.id] },
      draft: true,
      overrideAccess: true,
    })

    const published = await payload.update({
      collection: 'variants',
      id: second.id,
      data: { _status: 'published' },
      overrideAccess: true,
    })
    expect(published._status).toBe('published')
    await expect(
      payload.create({
        collection: 'variants',
        data: { product: product.id, options: [large!.id], _status: 'published' },
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})
