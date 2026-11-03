import { createPayloadRequest, initTransaction, killTransaction } from 'payload'
import { expect, vi } from 'vitest'

import { test } from '../__helpers/int/vitest.js'

vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_offline')
test.afterAll(() => vi.unstubAllEnvs())

test.suite('Ecommerce transaction visibility (#18338)', { config: './config.ts' }, () => {
  test('should create a product, variant and cart inside one transaction', async ({ payload }) => {
    const options = await payload.find({
      collection: 'variantOptions',
      overrideAccess: true,
      depth: 0,
      limit: 1,
    })
    const option = options.docs[0]!
    const req = await createPayloadRequest({ payload })
    await initTransaction(req)

    try {
      const product = await payload.create({
        collection: 'products',
        overrideAccess: true,
        req,
        data: {
          name: 'Transactional product',
          enableVariants: true,
          variantTypes: [option.variantType],
          priceInUSDEnabled: true,
          priceInUSD: 100,
        },
      })
      const variant = await payload.create({
        collection: 'variants',
        overrideAccess: true,
        depth: 0,
        req,
        data: {
          product: product.id,
          options: [option.id],
          inventory: 10,
          priceInUSDEnabled: true,
          priceInUSD: 150,
        },
      })
      const cart = await payload.create({
        collection: 'carts',
        overrideAccess: true,
        req,
        data: {
          currency: 'USD',
          items: [
            { product: product.id, quantity: 2 },
            { product: product.id, variant: variant.id, quantity: 3 },
          ],
        },
      })

      expect(variant.product).toBe(product.id)
      expect(variant.title).toBe(option.label)
      expect(cart.subtotal).toBe(650)
    } finally {
      await killTransaction(req)
    }
  })
})
