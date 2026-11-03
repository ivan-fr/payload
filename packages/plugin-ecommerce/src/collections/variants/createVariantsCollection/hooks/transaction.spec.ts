import type { CollectionBeforeChangeHook, PayloadRequest, Validate } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { beforeChangeCart } from '../../../carts/beforeChange.js'
import { variantsCollectionBeforeChange } from './beforeChange.js'
import { validateOptions } from './validateOptions.js'

function createRequest({
  product = { title: 'Shirt', variantTypes: ['size'], variants: { docs: [] }, priceInUSD: 100 },
  option = { label: 'Small', priceInUSD: 150 },
}: {
  product?: {
    title: string
    variantTypes: string[]
    variants: { docs: { options: string[] }[] }
    priceInUSD: number
  }
  option?: { label: string; priceInUSD: number }
} = {}) {
  const req = {
    transactionID: 'uncommitted-product',
    user: { id: 'user' },
    t: (key: string) => key,
  } as unknown as PayloadRequest
  const findByID = vi.fn().mockImplementation(async (args) => {
    // Model visibility of records created on the current transaction connection.
    if (args.req !== req) throw new Error('NotFound: product is not committed')
    return args.collection === 'products' ? product : option
  })
  req.payload = { findByID } as unknown as PayloadRequest['payload']
  return { req, findByID }
}

describe('ecommerce transaction visibility (#18338)', () => {
  it('should build the variant title from the uncommitted product and option', async () => {
    const { req, findByID } = createRequest()
    const data = { product: 'product', options: ['small'], title: '' }
    await variantsCollectionBeforeChange({
      productsSlug: 'products',
      variantOptionsSlug: 'options',
    })({ data, req } as Parameters<CollectionBeforeChangeHook>[0])

    expect(data.title).toBe('Shirt — Small')
    expect(findByID).toHaveBeenCalledTimes(2)
  })

  it('should validate options against the product in the same transaction', async () => {
    const { req } = createRequest()
    expect(
      await validateOptions()(['small'], {
        data: { product: 'product' },
        req,
      } as Parameters<Validate>[1]),
    ).toBe(true)
  })

  it('should still reject an existing option combination', async () => {
    const { req } = createRequest({
      product: {
        title: 'Shirt',
        priceInUSD: 100,
        variantTypes: ['size'],
        variants: { docs: [{ options: ['small'] }] },
      },
    })
    expect(
      await validateOptions()(['small'], {
        data: { product: 'product' },
        req,
      } as Parameters<Validate>[1]),
    ).toBe('ecommerce:variantOptionsAlreadyExists')
  })

  it('should calculate cart subtotals using the same transaction for products and variants', async () => {
    const { req, findByID } = createRequest()
    const data = {
      currency: 'USD',
      items: [
        { product: 'product', quantity: 2 },
        { variant: 'variant', quantity: 3 },
      ],
      subtotal: 0,
    }
    await beforeChangeCart({ productsSlug: 'products', variantsSlug: 'variants' })({
      data,
      operation: 'update',
      req,
    } as Parameters<CollectionBeforeChangeHook>[0])

    expect(data.subtotal).toBe(650)
    expect(findByID).toHaveBeenCalledTimes(2)
  })
})
