import { beforeEach, describe, expect, it, vi } from 'vitest'

const STRIPE_METADATA_VALUE_LIMIT = 500

const mockPaymentIntentsCreate = vi.fn()
const mockPaymentIntentsRetrieve = vi.fn()

vi.mock('stripe', () => {
  const MockStripe = function () {
    return {
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus-123' }),
        list: vi.fn().mockResolvedValue({ data: [{ id: 'cus-123' }] }),
      },
      paymentIntents: {
        create: mockPaymentIntentsCreate,
        retrieve: mockPaymentIntentsRetrieve,
      },
    }
  }

  return { default: Object.assign(MockStripe, { createFetchHttpClient: () => ({}) }) }
})

import { confirmOrder } from './confirmOrder.js'
import { initiatePayment } from './initiatePayment.js'
import { createCartItemsHash } from './validateSettlement.js'

type InitiatePaymentArgs = Parameters<ReturnType<typeof initiatePayment>>[0]
type ConfirmOrderArgs = Parameters<ReturnType<typeof confirmOrder>>[0]

const createCartItems = ({ count }: { count: number }) =>
  Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    product: `665f1f77bcf86cd7994390${String(index).padStart(2, '0')}`,
    quantity: index + 1,
    variant: `775f1f77bcf86cd7994390${String(index).padStart(2, '0')}`,
  }))

const realisticShippingAddress = {
  id: '665f1f77bcf86cd799439011',
  addressLine1:
    '1234 North Example Boulevard, Building C, Suite 4500, Attention: Receiving Dock 12',
  addressLine2: 'c/o The Very Long Company Name Incorporated, International Logistics Department',
  city: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch',
  company: 'The Very Long Company Name Incorporated International Holdings',
  country: 'GB',
  createdAt: '2026-10-01T10:00:00.000Z',
  customer: '665f1f77bcf86cd799439012',
  firstName: 'Maximilian-Alexander',
  lastName: 'Featherstonehaugh-Cholmondeley',
  phone: '+44 20 7946 0958',
  postalCode: 'LL61 5UJ',
  state: 'Isle of Anglesey',
  title: 'Dr.',
  updatedAt: '2026-10-02T10:00:00.000Z',
}

const runInitiatePayment = async ({
  hasTransactionShippingAddressField = true,
  items,
  shippingAddress = { city: 'Test City' },
}: {
  hasTransactionShippingAddressField?: boolean
  items: Record<string, unknown>[]
  shippingAddress?: Record<string, unknown>
}) => {
  const create = vi.fn().mockResolvedValue({ id: 'txn-123' })

  mockPaymentIntentsCreate.mockImplementation(
    ({ metadata }: { metadata: Record<string, string> }) => {
      for (const [key, value] of Object.entries(metadata)) {
        if (String(value).length > STRIPE_METADATA_VALUE_LIMIT) {
          throw new Error(
            `Metadata values can have up to 500 characters, but you passed in a value that is ${String(value).length} characters. Invalid value: ${key}`,
          )
        }
      }

      return {
        id: 'pi_123',
        amount: 1000,
        client_secret: 'secret',
        currency: 'usd',
        metadata,
      }
    },
  )

  const result = await initiatePayment({ secretKey: 'sk_test_123' })({
    data: {
      billingAddress: { city: 'Test City' },
      cart: { id: 'cart-123', items, subtotal: 1000 },
      currency: 'usd',
      customerEmail: 'buyer@example.com',
      shippingAddress,
    },
    req: {
      payload: {
        collections: {
          transactions: {
            config: {
              flattenedFields: hasTransactionShippingAddressField
                ? [{ name: 'shippingAddress' }]
                : [],
            },
          },
        },
        create,
        logger: { error: vi.fn() },
      },
      user: null,
    },
    transactionsSlug: 'transactions',
  } as unknown as InitiatePaymentArgs)

  return { create, result }
}

describe('Stripe cart items hash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initiate payment for a cart whose serialized items exceed the Stripe metadata limit', async () => {
    const items = createCartItems({ count: 12 })

    expect(JSON.stringify(items).length).toBeGreaterThan(STRIPE_METADATA_VALUE_LIMIT)

    const { create, result } = await runInitiatePayment({ items })
    const metadata = mockPaymentIntentsCreate.mock.calls[0]?.[0].metadata

    expect(result.paymentIntentID).toBe('pi_123')
    expect(metadata.cartItemsSnapshot).toBeUndefined()
    expect(metadata.cartItemsHash).toMatch(/^[0-9a-f]{64}$/)
    expect(create.mock.calls[0]?.[0].data.items).toHaveLength(12)
  })

  it('should store a realistic full shipping address on the transaction, keeping every metadata value under the limit', async () => {
    expect(JSON.stringify(realisticShippingAddress).length).toBeGreaterThan(
      STRIPE_METADATA_VALUE_LIMIT,
    )

    const { create } = await runInitiatePayment({
      items: createCartItems({ count: 12 }),
      shippingAddress: realisticShippingAddress,
    })
    const metadata = mockPaymentIntentsCreate.mock.calls[0]?.[0].metadata

    expect(metadata.shippingAddress).toBeUndefined()
    expect(
      Object.values(metadata).every((value) => String(value).length <= STRIPE_METADATA_VALUE_LIMIT),
    ).toBe(true)
    expect(create.mock.calls[0]?.[0].data.shippingAddress).toEqual(realisticShippingAddress)
  })

  it('should keep the address in metadata for a transactions collection without a shippingAddress field', async () => {
    const { create } = await runInitiatePayment({
      hasTransactionShippingAddressField: false,
      items: createCartItems({ count: 1 }),
    })

    expect(mockPaymentIntentsCreate.mock.calls[0]?.[0].metadata.shippingAddress).toBe(
      JSON.stringify({ city: 'Test City' }),
    )
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty('shippingAddress')
  })

  it('should ignore key order, row IDs, null variants and undefined custom properties when hashing', async () => {
    const expectedHash = await createCartItemsHash({
      items: [{ deliveryOption: { speed: 'express', window: 'am' }, product: 7, quantity: 2 }],
    })

    expect(
      await createCartItemsHash({
        items: [
          {
            id: 'row-1',
            deliveryOption: { window: 'am', speed: 'express' },
            giftNote: undefined,
            product: '7',
            quantity: 2,
            variant: null,
          },
        ],
      }),
    ).toBe(expectedHash)
    expect(
      await createCartItemsHash({
        items: [{ deliveryOption: { speed: 'standard', window: 'am' }, product: 7, quantity: 2 }],
      }),
    ).not.toBe(expectedHash)
  })

  it('should produce the same hash for stored transaction rows and the charged cart', async () => {
    const chargedItems = [{ product: 'product-1', quantity: 2, variant: 'variant-1' }]
    const storedItems = [
      { id: 'row-1', product: { id: 'product-1' }, quantity: 2, variant: { id: 'variant-1' } },
    ]

    expect(await createCartItemsHash({ items: storedItems })).toBe(
      await createCartItemsHash({ items: chargedItems }),
    )
    expect(await createCartItemsHash({ items: [{ ...chargedItems[0], quantity: 3 }] })).not.toBe(
      await createCartItemsHash({ items: chargedItems }),
    )
  })

  const createConfirmation = async ({
    cartItemsHash,
    digestItems,
    metadataShippingAddress,
    transactionItems,
    transactionShippingAddress,
  }: {
    cartItemsHash?: string
    metadataShippingAddress?: Record<string, unknown>
    transactionShippingAddress?: Record<string, unknown>
    digestItems: Record<string, unknown>[]
    transactionItems: Record<string, unknown>[]
  }) => {
    const finalizeOrder = vi.fn().mockResolvedValue({ id: 'order-123' })
    const transaction = {
      id: 'txn-123',
      amount: 1000,
      cart: 'cart-123',
      currency: 'USD',
      customer: 'user-123',
      items: transactionItems,
      shippingAddress: transactionShippingAddress,
      stripe: { customerID: 'cus-123', paymentIntentID: 'pi_123' },
    }

    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: 'pi_123',
      amount: 1000,
      currency: 'usd',
      customer: 'cus-123',
      metadata: {
        cartID: 'cart-123',
        cartItemsHash: cartItemsHash ?? (await createCartItemsHash({ items: digestItems })),
        ...(metadataShippingAddress
          ? { shippingAddress: JSON.stringify(metadataShippingAddress) }
          : {}),
      },
      status: 'succeeded',
    })

    const confirmation = confirmOrder({ secretKey: 'sk_test_123' })({
      data: { cartID: 'cart-123', paymentIntentID: 'pi_123' },
      finalizeOrder,
      req: {
        payload: {
          find: vi.fn().mockResolvedValue({ docs: [transaction], totalDocs: 1 }),
          logger: { error: vi.fn() },
        },
        user: { id: 'user-123', collection: 'users' },
      },
    } as unknown as ConfirmOrderArgs)

    return { confirmation, finalizeOrder }
  }

  it('should build order items from the transaction when the PaymentIntent carries a hash', async () => {
    const transactionItems = [
      { id: 'row-1', product: 7, quantity: 2, variant: null },
      { id: 'row-2', deliveryOption: 'express', product: 8, quantity: 1, variant: 9 },
    ]
    const { confirmation, finalizeOrder } = await createConfirmation({
      digestItems: transactionItems,
      transactionItems,
    })

    await confirmation

    expect(finalizeOrder.mock.calls[0]?.[0].orderData.items).toEqual([
      { product: 7, quantity: 2 },
      { deliveryOption: 'express', product: 8, quantity: 1, variant: 9 },
    ])
  })

  it('should take the order shipping address from the transaction, preferring legacy metadata when present', async () => {
    const items = [{ id: 'row-1', product: 7, quantity: 1 }]
    const fromTransaction = await createConfirmation({
      digestItems: items,
      transactionItems: items,
      transactionShippingAddress: realisticShippingAddress,
    })

    await fromTransaction.confirmation

    expect(fromTransaction.finalizeOrder.mock.calls[0]?.[0].orderData.shippingAddress).toEqual(
      realisticShippingAddress,
    )

    const fromMetadata = await createConfirmation({
      digestItems: items,
      metadataShippingAddress: { city: 'Legacy City' },
      transactionItems: items,
      transactionShippingAddress: { city: null },
    })

    await fromMetadata.confirmation

    expect(fromMetadata.finalizeOrder.mock.calls[0]?.[0].orderData.shippingAddress).toEqual({
      city: 'Legacy City',
    })

    const withoutAddress = await createConfirmation({
      digestItems: items,
      transactionItems: items,
      transactionShippingAddress: { city: null, country: '' },
    })

    await withoutAddress.confirmation

    expect(
      withoutAddress.finalizeOrder.mock.calls[0]?.[0].orderData.shippingAddress,
    ).toBeUndefined()
  })

  it('should reject a transaction whose items no longer match the PaymentIntent hash', async () => {
    const { confirmation, finalizeOrder } = await createConfirmation({
      digestItems: [{ product: 7, quantity: 1 }],
      transactionItems: [{ id: 'row-1', product: 7, quantity: 2 }],
    })

    await expect(confirmation).rejects.toThrow('items')
    expect(finalizeOrder).not.toHaveBeenCalled()
  })

  it('should reject an empty hash instead of falling back to the legacy snapshot', async () => {
    const { confirmation, finalizeOrder } = await createConfirmation({
      cartItemsHash: '',
      digestItems: [{ product: 7, quantity: 1 }],
      transactionItems: [{ id: 'row-1', product: 7, quantity: 1 }],
    })

    await expect(confirmation).rejects.toThrow('items')
    expect(finalizeOrder).not.toHaveBeenCalled()
  })
})
