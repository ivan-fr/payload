import { describe, expect, it, vi } from 'vitest'

import { createProductsCollection } from '../../../products/createProductsCollection.js'
import { createVariantsCollection } from '../index.js'
import { variantsCollectionBeforeChange } from './beforeChange.js'

const currenciesConfig = {
  defaultCurrency: 'USD',
  supportedCurrencies: [{ code: 'USD', decimals: 2, label: 'US dollar', symbol: '$' }],
}
const access = { isAdmin: () => true, adminOrPublishedStatus: () => true }

describe('variant titles (#19018)', () => {
  it('should derive a title from the latest product draft', async () => {
    const req = {
      payload: {
        findByID: vi.fn(async ({ collection, draft }) =>
          collection === 'products'
            ? { title: draft ? 'New shirt' : 'Old shirt' }
            : { label: 'Small' },
        ),
      },
    }
    const data = { product: 1, options: [2] }
    await variantsCollectionBeforeChange({
      productsSlug: 'products',
      variantOptionsSlug: 'options',
    })({ data, req } as never)
    expect(data).toMatchObject({ title: 'New shirt — Small' })
  })

  it('should refresh every variant on a product rename, preserving each draft state', async () => {
    const update = vi.fn()
    const find = vi.fn(async () => ({
      docs: [
        { id: 1, options: [2], _status: 'published' },
        { id: 3, options: [4], _status: 'draft' },
      ],
    }))
    const req = { payload: { find, update } }
    const collection = createProductsCollection({
      currenciesConfig,
      access,
      enableVariants: true,
      inventory: false,
    })
    for (const hook of collection.hooks?.afterChange ?? [])
      await hook({
        req,
        operation: 'update',
        doc: { id: 5, title: 'New', _status: 'published' },
        previousDoc: { title: 'Old' },
      } as never)
    expect(update).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 1, req, draft: false }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 3, req, draft: true }))
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: false, limit: 0, req, draft: true }),
    )
  })

  it('should mark the always-derived title field read-only', () => {
    const collection = createVariantsCollection({ access, inventory: false })
    expect(collection.fields.find((f) => 'name' in f && f.name === 'title')!.admin?.readOnly).toBe(
      true,
    )
  })
  it('should save refreshed labels as drafts when the product save is a draft', async () => {
    const update = vi.fn()
    const req = {
      payload: {
        find: vi.fn(async () => ({ docs: [{ id: 1, options: [2], _status: 'published' }] })),
        update,
      },
    }
    const collection = createProductsCollection({
      currenciesConfig,
      access,
      enableVariants: true,
      inventory: false,
    })
    for (const hook of collection.hooks?.afterChange ?? [])
      await hook({
        req,
        operation: 'update',
        doc: { id: 5, title: 'New', _status: 'draft' },
        previousDoc: { title: 'Old' },
      } as never)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ draft: true }))
  })

  it('should skip unchanged titles and surface a failed variant write', async () => {
    const failure = new Error('variant unavailable')
    const req = {
      payload: {
        find: vi.fn(async () => ({ docs: [{ id: 1, options: [2] }] })),
        update: vi.fn().mockRejectedValue(failure),
      },
    }
    const collection = createProductsCollection({
      currenciesConfig,
      access,
      enableVariants: true,
      inventory: false,
    })
    for (const hook of collection.hooks?.afterChange ?? []) {
      await hook({
        req,
        operation: 'update',
        doc: { title: 'Same' },
        previousDoc: { title: 'Same' },
      } as never)
      expect(req.payload.find).not.toHaveBeenCalled()
      await expect(
        hook({
          req,
          operation: 'update',
          doc: { id: 5, title: 'New' },
          previousDoc: { title: 'Old' },
        } as never),
      ).rejects.toBe(failure)
    }
  })
})
