import type { PayloadRequest } from 'payload'

import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { stripeAdapter } from './index.js'

const fixture = ({
  user,
  customersSlug = 'users',
}: { user?: Record<string, unknown>; customersSlug?: string } = {}) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.includes('/customers')
        ? Response.json({ data: [{ id: 'cus_test' }] })
        : Response.json({ id: 'pi_test', amount: 1000, currency: 'usd', client_secret: 'secret' }),
    ),
  )
  const create = vi.fn(
    async (_args: {
      data: { items: Record<string, unknown>[]; customer?: unknown; customerEmail?: unknown }
    }) => ({ id: 1 }),
  )
  const req = {
    user: user ?? null,
    payload: { create, logger: { error: vi.fn() } },
  } as unknown as PayloadRequest
  const row = { id: 'cart-row', product: { id: 1 }, quantity: 1, deliveryOption: 'express' }
  const adapter = stripeAdapter({ secretKey: randomUUID(), publishableKey: randomUUID() })
  const run = () =>
    adapter.initiatePayment!({
      customersSlug,
      req,
      transactionsSlug: 'transactions',
      data: {
        customerEmail: 'guest@example.com',
        currency: 'usd',
        cart: { id: 1, subtotal: 1000, items: [row] },
      },
    } as never)
  return { run, create, row, req }
}
afterEach(() => vi.unstubAllGlobals())

describe('Stripe transaction rows and purchaser identity', () => {
  it('should generate new transaction item IDs and preserve custom cart properties (#16453)', async () => {
    const { run, create, row } = fixture()
    await run()
    const item = create.mock.calls[0]![0].data.items[0]
    expect(item).not.toHaveProperty('id')
    expect(item).toMatchObject({ product: 1, quantity: 1, deliveryOption: 'express' })
    expect(row.id).toBe('cart-row')
  })

  it('should treat a user from another auth collection as a guest (#16377)', async () => {
    const { run, create } = fixture({ user: { id: 7, collection: 'api-keys' } })
    await run()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerEmail: 'guest@example.com' }),
      }),
    )
    expect(create.mock.calls[0]![0].data).not.toHaveProperty('customer')
  })

  it('should retain authenticated customers in a custom customer collection (#16377)', async () => {
    const { run, create } = fixture({
      customersSlug: 'members',
      user: { id: 7, collection: 'members' },
    })
    await run()
    expect(create.mock.calls[0]![0].data.customer).toBe(7)
  })
})
