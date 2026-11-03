import { createPayloadRequest } from 'payload'
import { expect, vi } from 'vitest'

import { initiatePaymentHandler } from '../../packages/plugin-ecommerce/src/endpoints/initiatePayment.js'
import { test } from '../__helpers/int/vitest.js'

vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_offline')
test.afterAll(() => vi.unstubAllEnvs())

test.suite('Payment variant stock validation (#18339)', { config: './config.ts' }, () => {
  test('should reject an overstocked variant cart before invoking the offline payment adapter', async ({
    payload,
  }) => {
    const users = await payload.find({ collection: 'users', overrideAccess: true, limit: 1 })
    const user = { ...users.docs[0]!, collection: 'users' }
    const options = await payload.find({
      collection: 'variantOptions',
      overrideAccess: true,
      depth: 0,
      limit: 1,
    })
    const option = options.docs[0]!
    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Payment stock regression',
        enableVariants: true,
        variantTypes: [option.variantType],
        _status: 'published',
      },
      overrideAccess: true,
    })
    const variant = await payload.create({
      collection: 'variants',
      data: {
        product: product.id,
        options: [option.id],
        inventory: 1,
        priceInUSDEnabled: true,
        priceInUSD: 150,
        _status: 'published',
      },
      overrideAccess: true,
    })
    const cart = await payload.create({
      collection: 'carts',
      data: {
        customer: user.id,
        currency: 'USD',
        items: [{ product: product.id, variant: variant.id, quantity: 2 }],
      },
      overrideAccess: true,
    })
    const initiatePayment = vi.fn().mockResolvedValue({ paymentIntentID: 'offline' })
    const handler = initiatePaymentHandler({
      currenciesConfig: {
        defaultCurrency: 'USD',
        supportedCurrencies: [{ code: 'USD', decimals: 2, label: 'Dollar', symbol: '$' }],
      },
      paymentMethod: { name: 'offline', initiatePayment } as never,
    })
    const req = await createPayloadRequest({ payload, user })
    req.data = { cartID: cart.id }

    expect((await handler(req)).status).toBe(400)
    expect(initiatePayment).not.toHaveBeenCalled()
    expect(
      (await payload.findByID({ collection: 'variants', id: variant.id, overrideAccess: true }))
        .inventory,
    ).toBe(1)
  })
})
