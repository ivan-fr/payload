import type { PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { initiatePaymentHandler } from './initiatePayment.js'

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  addDataAndFileToRequest: vi.fn(),
}))

function createHarness({
  variant = { id: 'variant', inventory: 1, priceInUSD: 150 },
  item = { product: 'product', variant: 'variant', quantity: 2 },
  productsValidation,
}: {
  variant?: null | Record<string, unknown>
  item?: Record<string, unknown>
  productsValidation?: Parameters<typeof initiatePaymentHandler>[0]['productsValidation']
} = {}) {
  const initiatePayment = vi.fn().mockResolvedValue({ paymentIntentID: 'offline-payment' })
  const findByID = vi
    .fn()
    .mockImplementation(async ({ collection }) =>
      collection === 'carts'
        ? { currency: 'USD', items: [item] }
        : collection === 'variants'
          ? variant
          : { id: 'product', inventory: 4, priceInUSD: 100 },
    )
  const req = {
    data: { cartID: 'cart', customerEmail: 'buyer@example.com' },
    query: {},
    payload: { findByID, logger: { error: vi.fn() } },
  } as unknown as PayloadRequest
  const handler = initiatePaymentHandler({
    currenciesConfig: {
      defaultCurrency: 'USD',
      supportedCurrencies: [{ code: 'USD', decimals: 2, label: 'Dollar', symbol: '$' }],
    },
    paymentMethod: { name: 'offline', initiatePayment } as never,
    productsValidation,
  })

  return { handler, req, initiatePayment, findByID }
}

describe('payment variant validation (#18339)', () => {
  it.each([{ inventory: 1, priceInUSD: 150 }, { inventory: 3 }])(
    'should refuse invalid variant stock or price before contacting the provider: %j',
    async (variant) => {
      const { handler, req, initiatePayment } = createHarness({
        variant: { id: 'variant', ...variant },
      })
      expect((await handler(req)).status).toBe(400)
      expect(initiatePayment).not.toHaveBeenCalled()
    },
  )

  it('should return 404 for a missing variant', async () => {
    const { handler, req, initiatePayment } = createHarness({ variant: null })
    expect((await handler(req)).status).toBe(404)
    expect(initiatePayment).not.toHaveBeenCalled()
  })

  it('should call custom validation for variants and preserve its rejection', async () => {
    const productsValidation = vi.fn().mockRejectedValue(new Error('Custom stock policy'))
    const { handler, req, initiatePayment } = createHarness({ productsValidation })
    expect((await handler(req)).status).toBe(400)
    expect(productsValidation).toHaveBeenCalledWith(
      expect.objectContaining({ variant: expect.objectContaining({ id: 'variant' }), quantity: 2 }),
    )
    expect(initiatePayment).not.toHaveBeenCalled()
  })

  it.each([
    { product: 'product', quantity: 2 },
    { product: 'product', variant: 'variant', quantity: 1 },
  ])('should allow valid product and variant carts: %j', async (item) => {
    const { handler, req, initiatePayment } = createHarness({ item })
    expect((await handler(req)).status).toBe(200)
    expect(initiatePayment).toHaveBeenCalledTimes(1)
  })
})
