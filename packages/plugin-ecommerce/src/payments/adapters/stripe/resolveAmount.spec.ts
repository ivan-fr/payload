import type { PayloadRequest } from 'payload'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { StripeAdapterArgs } from './index.js'
import { stripeAdapter } from './index.js'

const fixture = ({ resolveAmount }: Pick<StripeAdapterArgs, 'resolveAmount'> = {}) => {
  const fetchStripe = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/customers')) return Response.json({ data: [{ id: 'cus_test' }] })
    const params = new URLSearchParams(init?.body as string)
    return Response.json({
      id: 'pi_test',
      amount: Number(params.get('amount')),
      currency: 'usd',
      client_secret: 'secret',
    })
  })
  vi.stubGlobal('fetch', fetchStripe)
  const create = vi.fn().mockResolvedValue({ id: 'transaction' })
  const req = {
    user: null,
    payload: { create, logger: { error: vi.fn() } },
  } as unknown as PayloadRequest
  const cart = { id: 'cart', subtotal: 1000, items: [{ product: 'product', quantity: 1 }] }
  const adapter = stripeAdapter({
    secretKey: 'sk_test_fixture',
    publishableKey: 'pk_test_fixture',
    resolveAmount,
  })
  const run = () =>
    adapter.initiatePayment({
      customersSlug: 'users',
      transactionsSlug: 'transactions',
      req,
      data: { customerEmail: 'test@example.com', currency: 'usd', cart },
    } as never)
  return { run, create, fetchStripe, cart, req }
}

afterEach(() => vi.unstubAllGlobals())

describe('Stripe charge resolver (#15784)', () => {
  it('should await server pricing and persist the charge returned by Stripe', async () => {
    const resolveAmount = vi.fn(async ({ cart }) => cart.subtotal + 250)
    const { run, create, fetchStripe, cart, req } = fixture({ resolveAmount })
    await run()

    expect(resolveAmount).toHaveBeenCalledWith(expect.objectContaining({ cart, req }))
    const call = fetchStripe.mock.calls.find(([url]) => url.includes('/payment_intents'))
    expect(new URLSearchParams(call[1].body as string).get('amount')).toBe('1250')
    expect(create.mock.calls[0][0].data.amount).toBe(1250)
    expect(cart.subtotal).toBe(1000)
  })

  it('should retain subtotal pricing without a resolver', async () => {
    const { run, create } = fixture()
    await run()

    expect(create.mock.calls[0][0].data.amount).toBe(1000)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'should reject invalid charge %s before calling Stripe',
    async (amount) => {
      const { run, create, fetchStripe } = fixture({ resolveAmount: () => amount })

      await expect(run()).rejects.toThrow('valid amount')
      expect(fetchStripe).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
    },
  )

  it('should propagate resolver failures without charging the customer', async () => {
    const { run, fetchStripe } = fixture({
      resolveAmount: () => {
        throw new Error('Pricing unavailable')
      },
    })

    await expect(run()).rejects.toThrow('Pricing unavailable')
    expect(fetchStripe).not.toHaveBeenCalled()
  })
})
