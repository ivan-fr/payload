import type { PayloadRequest } from 'payload'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { stripeAdapter } from './index.js'

const createAdapter = () =>
  stripeAdapter({ secretKey: 'sk_test_fixture', publishableKey: 'pk_test_fixture' })
const items = Array.from({ length: 20 }, (_, index) => ({
  product: `product-${index}`,
  quantity: 1,
  custom: 'delivery-option',
}))
const address = {
  addressLine1: 'A'.repeat(450),
  addressLine2: 'B'.repeat(200),
  city: 'Paris',
  country: 'FR',
  postalCode: '75019',
}

afterEach(() => vi.unstubAllGlobals())

describe('bounded Stripe metadata (#19017, #19055)', () => {
  it.each([
    { name: 'a large cart', cartItems: items, shippingAddress: { addressLine1: 'Short' } },
    { name: 'a long shipping address', cartItems: [items[0]!], shippingAddress: address },
  ])(
    'should initiate $name and retain its data on the transaction',
    async ({ cartItems, shippingAddress }) => {
      let metadata: Record<string, string> = {}
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init?: RequestInit) => {
          if (url.includes('/customers')) return Response.json({ data: [{ id: 'cus_test' }] })
          const params = new URLSearchParams(init?.body as string)
          metadata = Object.fromEntries(
            [...params.entries()].filter(([key]) => key.startsWith('metadata[')),
          )
          if (Object.values(metadata).some((value) => value.length > 500)) {
            return Response.json(
              {
                error: {
                  type: 'invalid_request_error',
                  message: 'Metadata exceeds 500 characters',
                },
              },
              { status: 400 },
            )
          }
          return Response.json({
            id: 'pi_test',
            amount: 1000,
            currency: 'usd',
            client_secret: 'secret',
          })
        }),
      )
      const create = vi.fn().mockResolvedValue({ id: 'transaction' })
      const req = {
        user: null,
        payload: { create, logger: { error: vi.fn() } },
      } as unknown as PayloadRequest
      await expect(
        createAdapter().initiatePayment!({
          req,
          transactionsSlug: 'transactions',
          data: {
            customerEmail: 'buyer@example.com',
            currency: 'usd',
            cart: { id: 'cart', subtotal: 1000, items: cartItems },
            shippingAddress,
          },
        } as never),
      ).resolves.toMatchObject({ paymentIntentID: 'pi_test' })
      expect(metadata['metadata[cartItemsHash]']).toMatch(/^[a-f0-9]{64}$/)
      expect(metadata).not.toHaveProperty('metadata[cartItemsSnapshot]')
      expect(metadata).not.toHaveProperty('metadata[shippingAddress]')
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ items: cartItems, shippingAddress }),
        }),
      )
    },
  )

  it('should confirm a legacy intent without snapshot/hash from the persisted transaction', async () => {
    const transaction = {
      id: 'transaction',
      amount: 1000,
      currency: 'USD',
      cart: 'cart',
      customerEmail: 'buyer@example.com',
      items,
      shippingAddress: address,
      stripe: { paymentIntentID: 'pi_test', customerID: 'cus_test' },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          id: 'pi_test',
          amount: 1000,
          currency: 'usd',
          customer: 'cus_test',
          status: 'succeeded',
          metadata: { cartID: 'cart' },
        }),
      ),
    )
    const finalizeOrder = vi.fn().mockResolvedValue({ id: 'order' })
    const req = {
      user: null,
      payload: {
        find: vi.fn().mockResolvedValue({ docs: [transaction], totalDocs: 1 }),
        logger: { error: vi.fn() },
      },
    } as unknown as PayloadRequest
    await createAdapter().confirmOrder!({
      req,
      finalizeOrder,
      data: { paymentIntentID: 'pi_test', cartID: 'cart', customerEmail: 'buyer@example.com' },
    } as never)
    expect(finalizeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderData: expect.objectContaining({ items, shippingAddress: address }),
      }),
    )
  })
})
