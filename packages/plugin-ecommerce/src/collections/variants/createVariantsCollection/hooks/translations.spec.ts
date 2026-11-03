import type { PayloadRequest, Validate } from 'payload'

import { randomUUID } from 'node:crypto'
import { t } from '@payloadcms/translations'
import { describe, expect, it, vi } from 'vitest'

import { ecommercePlugin } from '../../../../index.js'
import { validateOptions } from './validateOptions.js'

const harness = async ({
  variantTypes = ['size'],
  variants = [],
}: { variantTypes?: string[]; variants?: Record<string, unknown>[] } = {}) => {
  const config = await ecommercePlugin({
    access: {
      adminOnlyFieldAccess: () => true,
      adminOrPublishedStatus: () => true,
      isAdmin: () => true,
      isDocumentOwner: () => true,
    },
    customers: { slug: 'users' },
    products: false,
    carts: false,
    orders: false,
    transactions: false,
  })({ secret: randomUUID() })
  const req = {
    payload: {
      findByID: vi.fn().mockResolvedValue({ variantTypes, variants: { docs: variants } }),
    },
    t: (key: string) => t({ key, translations: config.i18n!.translations!.en }),
  } as unknown as PayloadRequest

  return req
}

describe('translated variant validation (#19021)', () => {
  it.each([
    { values: [], data: { product: 'p' }, expected: 'Variant options are required.' },
    { values: ['small'], data: {}, expected: 'A product is required.' },
  ])(
    'should return "$expected" through the plugin registration and translation lookup',
    async ({ values, data, expected }) => {
      const req = await harness()

      expect(await validateOptions()(values, { data, req } as Parameters<Validate>[1])).toBe(
        expected,
      )
    },
  )

  it('should explain incomplete combinations in human-readable text', async () => {
    const req = await harness({ variantTypes: ['size', 'color'] })

    expect(
      await validateOptions()(['small'], {
        data: { product: 'p' },
        req,
      } as Parameters<Validate>[1]),
    ).toBe('All variant options are required.')
  })

  it('should explain duplicates and retain the correction suggestion', async () => {
    const req = await harness({ variants: [{ id: 'other', options: ['small'] }] })

    expect(
      await validateOptions()(['small'], {
        data: { product: 'p' },
        req,
      } as Parameters<Validate>[1]),
    ).toBe(
      'This variant combo is already in use by another variant. Please select different options.',
    )
  })
})
