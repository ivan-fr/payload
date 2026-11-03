import type { PayloadRequest } from 'payload'

import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  configurations: [] as Record<string, unknown>[],
  httpClient: { transport: 'fetch' },
  createFetchHttpClient: vi.fn(),
  listCustomers: vi.fn(),
  createPaymentIntent: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  constructEvent: vi.fn(),
}))

vi.mock('stripe', () => {
  class Stripe {
    static createFetchHttpClient = sdk.createFetchHttpClient
    constructor(_secret: string, options: Record<string, unknown>) {
      sdk.configurations.push(options)
    }
    customers = { list: sdk.listCustomers }
    paymentIntents = { create: sdk.createPaymentIntent, retrieve: sdk.retrievePaymentIntent }
    webhooks = { constructEvent: sdk.constructEvent }
  }
  return { default: Stripe }
})

import { stripeAdapter } from './index.js'

beforeEach(() => {
  vi.clearAllMocks()
  sdk.configurations.length = 0
  sdk.createFetchHttpClient.mockReturnValue(sdk.httpClient)
})

const adapter = () =>
  stripeAdapter({
    secretKey: randomUUID(),
    publishableKey: randomUUID(),
    webhookSecret: randomUUID(),
  })

const assertFetchTransport = () => {
  expect(sdk.createFetchHttpClient).toHaveBeenCalledOnce()
  expect(sdk.configurations).toHaveLength(1)
  expect(sdk.configurations[0]!.httpClient).toBe(sdk.httpClient)
}

describe('fetch transport for the Stripe adapter (#17201)', () => {
  it('should initiate payment with the fetch client', async () => {
    sdk.listCustomers.mockResolvedValue({ data: [{ id: 'customer' }] })
    sdk.createPaymentIntent.mockResolvedValue({
      id: 'intent',
      amount: 1000,
      currency: 'usd',
      client_secret: 'client',
    })
    const create = vi.fn().mockResolvedValue({ id: 'transaction' })
    const req = {
      payload: { create, logger: { error: vi.fn() } },
      user: null,
    } as unknown as PayloadRequest

    await adapter().initiatePayment!({
      data: {
        customerEmail: 'buyer@example.com',
        currency: 'usd',
        cart: { id: 'cart', subtotal: 1000, items: [{ product: 'p', quantity: 1 }] },
      },
      req,
      transactionsSlug: 'transactions',
    })
    assertFetchTransport()
    expect(create).toHaveBeenCalledOnce()
  })

  it('should confirm with the fetch client while preserving settlement checks', async () => {
    const items = [{ product: 'p', quantity: 1 }]
    const transaction = {
      id: 'transaction',
      amount: 1000,
      currency: 'USD',
      cart: 'cart',
      customerEmail: 'buyer@example.com',
      items,
      status: 'pending',
      stripe: { paymentIntentID: 'intent', customerID: 'customer' },
    }
    sdk.retrievePaymentIntent.mockResolvedValue({
      id: 'intent',
      amount: 1000,
      currency: 'usd',
      customer: 'customer',
      status: 'succeeded',
      metadata: { cartID: 'cart', cartItemsSnapshot: JSON.stringify(items) },
    })
    const req = {
      payload: {
        find: vi.fn().mockResolvedValue({ docs: [transaction], totalDocs: 1 }),
        logger: { error: vi.fn() },
      },
      user: null,
    } as unknown as PayloadRequest
    const finalizeOrder = vi.fn().mockResolvedValue({ id: 'order' })

    await adapter().confirmOrder!({
      data: { cartID: 'cart', customerEmail: 'buyer@example.com', paymentIntentID: 'intent' },
      req,
      finalizeOrder,
    })
    assertFetchTransport()
    expect(finalizeOrder).toHaveBeenCalledOnce()
  })

  it('should provide a fetch-capable SDK to webhook callbacks', async () => {
    sdk.constructEvent.mockReturnValue({ type: 'payment_intent.succeeded' })
    const handler = vi.fn()
    const payment = stripeAdapter({
      secretKey: randomUUID(),
      publishableKey: randomUUID(),
      webhookSecret: randomUUID(),
      webhooks: { 'payment_intent.succeeded': handler },
    })
    const req = {
      text: async () => '{}',
      headers: new Headers({ 'stripe-signature': 'test-signature' }),
      payload: { logger: { error: vi.fn() } },
    } as unknown as PayloadRequest

    const response = await payment.endpoints![0]!.handler(req)
    expect(response.status).toBe(200)
    assertFetchTransport()
    expect(handler).toHaveBeenCalledOnce()
  })
})
