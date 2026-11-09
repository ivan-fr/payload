import { randomUUID } from 'node:crypto'
import { createPayloadRequest } from 'payload'
import { expect, vi } from 'vitest'

import { stripeAdapter } from '../../packages/plugin-ecommerce/src/payments/adapters/stripe/index.js'
import { test } from '../__helpers/int/vitest.js'
import {
  cartsSlug,
  machinesSlug,
  optionsSlug,
  productsSlug,
  transactionsSlug,
  typesSlug,
  variantsSlug,
} from './slugs.js'

test.suite('Server regressions batch 12', { config: './config.ts' }, () => {
  test.afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('should reject duplicate variant combinations beyond the first ten siblings (#18498)', async ({
    payload,
  }) => {
    const type = await payload.create({
      overrideAccess: true,
      collection: typesSlug,
      data: { name: 'size', label: 'Size' },
    })
    const product = await payload.create({
      overrideAccess: true,
      collection: productsSlug,
      data: { title: 'Shirt', _status: 'published', enableVariants: true, variantTypes: [type.id] },
    })
    const options = []
    for (let i = 0; i < 12; i++) {
      const option = await payload.create({
        overrideAccess: true,
        collection: optionsSlug,
        data: { label: `Size ${i}`, value: String(i).padStart(2, '0'), variantType: type.id },
      })
      options.push(option)
      await payload.create({
        overrideAccess: true,
        collection: variantsSlug,
        data: { product: product.id, options: [option.id], _status: 'published' },
      })
    }
    const choices = await payload.findByID({
      overrideAccess: true,
      collection: typesSlug,
      id: type.id,
      joins: { options: { limit: 0, sort: 'value' } },
    })
    expect(choices.options!.docs).toHaveLength(12)
    await expect(
      payload.create({
        overrideAccess: true,
        collection: variantsSlug,
        data: { product: product.id, options: [options[0]!.id], _status: 'published' },
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  test('should update existing variant titles and use the latest product draft for new variants (#19018)', async ({
    payload,
  }) => {
    const type = await payload.create({
      overrideAccess: true,
      collection: typesSlug,
      data: { name: 'size' },
    })
    const small = await payload.create({
      overrideAccess: true,
      collection: optionsSlug,
      data: { label: 'Small', value: 's', variantType: type.id },
    })
    const large = await payload.create({
      overrideAccess: true,
      collection: optionsSlug,
      data: { label: 'Large', value: 'l', variantType: type.id },
    })
    const product = await payload.create({
      overrideAccess: true,
      collection: productsSlug,
      data: { title: 'Shirt', enableVariants: true, variantTypes: [type.id], _status: 'published' },
    })
    const variant = await payload.create({
      overrideAccess: true,
      collection: variantsSlug,
      data: { product: product.id, options: [small.id], _status: 'published' },
    })
    await payload.update({
      overrideAccess: true,
      collection: productsSlug,
      id: product.id,
      draft: false,
      data: { title: 'Published shirt' },
    })
    expect(
      (
        await payload.findByID({
          overrideAccess: true,
          collection: variantsSlug,
          id: variant.id,
          draft: false,
        })
      ).title,
    ).toBe('Published shirt — Small')
    await payload.update({
      overrideAccess: true,
      collection: productsSlug,
      id: product.id,
      draft: true,
      data: { title: 'New shirt' },
    })
    const refreshed = await payload.findByID({
      overrideAccess: true,
      collection: variantsSlug,
      id: variant.id,
      draft: true,
    })
    expect(refreshed.title).toBe('New shirt — Small')
    expect(refreshed._status).toBe('draft')
    const published = await payload.findByID({
      overrideAccess: true,
      collection: variantsSlug,
      id: variant.id,
      draft: false,
    })
    expect(published).toMatchObject({ title: 'Published shirt — Small', _status: 'published' })
    const created = await payload.create({
      overrideAccess: true,
      collection: variantsSlug,
      data: { product: product.id, options: [large.id], _status: 'published' },
    })
    expect(created.title).toBe('New shirt — Large')
  })

  test('should create independent transaction item rows on repeated Stripe initiation (#16453)', async ({
    payload,
  }) => {
    const product = await payload.create({
      overrideAccess: true,
      collection: productsSlug,
      data: { title: 'Shirt', _status: 'published' },
    })
    const cart = await payload.create({
      overrideAccess: true,
      collection: cartsSlug,
      data: {
        currency: 'USD',
        subtotal: 1000,
        items: [{ product: product.id, quantity: 1, deliveryOption: 'express' }],
      },
    })
    let intent = 0
    const intents = new Map<string, Record<string, unknown>>()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: { method: string; body?: string }) => {
        if (url.includes('/customers')) return Response.json({ data: [{ id: 'cus_test' }] })
        if (options.method === 'GET') return Response.json(intents.get(url.split('/').at(-1)!))
        const body = new URLSearchParams(options.body)
        const paymentIntent = {
          id: `pi_${++intent}`,
          amount: 1000,
          currency: 'usd',
          customer: 'cus_test',
          status: 'succeeded',
          client_secret: 'client_secret',
          metadata: Object.fromEntries(
            [...body].flatMap(([key, value]) => {
              const match = /^metadata\[(.+)\]$/.exec(key)
              return match ? [[match[1], value]] : []
            }),
          ),
        }
        intents.set(paymentIntent.id, paymentIntent)
        return Response.json(paymentIntent)
      }),
    )
    const adapter = stripeAdapter({ secretKey: randomUUID(), publishableKey: randomUUID() })
    const req = await createPayloadRequest({ payload })
    for (let i = 0; i < 3; i++)
      await adapter.initiatePayment!({
        transactionsSlug,
        req,
        data: { cart, currency: 'usd', customerEmail: 'buyer@example.com' },
      } as never)
    const transactions = await payload.find({
      overrideAccess: true,
      collection: transactionsSlug,
      depth: 0,
      pagination: false,
    })
    expect(transactions.docs).toHaveLength(3)
    const rowIDs = transactions.docs.map((doc) => doc.items![0]!.id)
    expect(new Set(rowIDs).size).toBe(3)
    expect(rowIDs).not.toContain(cart.items![0]!.id)
    expect(transactions.docs.every((doc) => doc.items![0]!.deliveryOption === 'express')).toBe(true)
    req.user = { id: 999, collection: machinesSlug } as never
    const finalizeOrder = vi.fn(async (_args: { orderData: Record<string, unknown> }) => ({
      id: 'order',
    }))
    await adapter.confirmOrder!({
      req,
      transactionsSlug,
      data: { cartID: cart.id, customerEmail: 'buyer@example.com', paymentIntentID: 'pi_1' },
      finalizeOrder,
    } as never)
    expect(finalizeOrder).toHaveBeenCalledOnce()
    expect(finalizeOrder.mock.calls[0]![0].orderData.customerEmail).toBe('buyer@example.com')
    expect(finalizeOrder.mock.calls[0]![0].orderData).not.toHaveProperty('customer')
  })

  test('should preserve API-key authentication while using the submitted guest email (#16377)', async ({
    payload,
    restClient,
  }) => {
    const apiKey = randomUUID()
    await payload.create({
      overrideAccess: true,
      collection: machinesSlug,
      data: { name: 'Application', apiKey },
    })
    const product = await payload.create({
      overrideAccess: true,
      collection: productsSlug,
      data: { title: 'Shirt', _status: 'published' },
    })
    const cart = await payload.create({
      overrideAccess: true,
      collection: cartsSlug,
      data: { currency: 'USD', subtotal: 1000, items: [{ product: product.id, quantity: 1 }] },
    })
    const headers = { Authorization: `${machinesSlug} API-Key ${apiKey}` }
    const response = await restClient.POST('/batch12/initiate', {
      headers,
      body: JSON.stringify({ cartID: cart.id, customerEmail: 'guest@example.com' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      customerEmail: 'guest@example.com',
      principal: machinesSlug,
    })
    const missing = await restClient.POST('/batch12/initiate', {
      headers,
      body: JSON.stringify({ cartID: cart.id }),
    })
    expect(missing.status).toBe(400)
  })
})
