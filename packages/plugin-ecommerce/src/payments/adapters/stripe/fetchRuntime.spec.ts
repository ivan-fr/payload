import type { PayloadRequest } from 'payload'

import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { stripeAdapter } from './index.js'

afterEach(() => vi.unstubAllGlobals())

const items = [{ product: 'product', quantity: 1 }]
const paymentIntent = {
  id: 'pi_test',
  amount: 1000,
  currency: 'usd',
  customer: 'cus_test',
  status: 'succeeded',
  client_secret: 'client_test',
  metadata: { cartID: 'cart', cartItemsSnapshot: JSON.stringify(items) },
}
const createAdapter = () => stripeAdapter({ secretKey: randomUUID(), publishableKey: randomUUID() })

const stubFetch = () => {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    if (url.startsWith('https://api.stripe.com/v1/customers'))
      return Response.json({ data: [{ id: 'cus_test' }] })
    if (url.startsWith('https://api.stripe.com/v1/payment_intents'))
      return Response.json(paymentIntent)
    throw new Error(`Unexpected SDK request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

describe('real Stripe SDK with a stubbed fetch boundary (#17201)', () => {
  it('should complete initiation through fetch without opening a Stripe socket', async () => {
    const fetchMock = stubFetch()
    const req = {
      payload: {
        create: vi.fn().mockResolvedValue({ id: 'transaction' }),
        logger: { error: vi.fn() },
      },
      user: null,
    } as unknown as PayloadRequest

    const result = await createAdapter().initiatePayment!({
      data: {
        customerEmail: 'buyer@example.com',
        currency: 'usd',
        cart: { id: 'cart', subtotal: 1000, items },
      },
      req,
      transactionsSlug: 'transactions',
    })
    expect(result).toMatchObject({ paymentIntentID: 'pi_test' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['GET', 'POST'])
  })

  it('should retrieve and validate settlement through fetch before finalizing', async () => {
    const fetchMock = stubFetch()
    const transaction = {
      id: 'transaction',
      amount: 1000,
      currency: 'USD',
      cart: 'cart',
      customerEmail: 'buyer@example.com',
      items,
      status: 'pending',
      stripe: { paymentIntentID: 'pi_test', customerID: 'cus_test' },
    }
    const req = {
      payload: {
        find: vi.fn().mockResolvedValue({ docs: [transaction], totalDocs: 1 }),
        logger: { error: vi.fn() },
      },
      user: null,
    } as unknown as PayloadRequest
    const finalizeOrder = vi.fn().mockResolvedValue({ id: 'order' })

    const result = await createAdapter().confirmOrder!({
      data: { cartID: 'cart', customerEmail: 'buyer@example.com', paymentIntentID: 'pi_test' },
      req,
      finalizeOrder,
    })
    expect(result.orderID).toBe('order')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.stripe.com/v1/payment_intents/pi_test')
    expect(finalizeOrder).toHaveBeenCalledOnce()
  })
})
