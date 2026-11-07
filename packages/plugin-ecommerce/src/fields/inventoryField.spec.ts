import { describe, expect, it } from 'vitest'
import { createProductsCollection } from '../collections/products/createProductsCollection.js'
import { createVariantsCollection } from '../collections/variants/createVariantsCollection/index.js'
const access = { isAdmin: () => true, adminOrPublishedStatus: () => true }
const currenciesConfig = { defaultCurrency: 'USD', supportedCurrencies: [] }
describe('configured inventory schema (#18288)', () => {
  it.each([createProductsCollection, createVariantsCollection])(
    'should create the configured field for %s',
    (createCollection) => {
      const config = createCollection({
        access,
        currenciesConfig,
        inventory: { fieldName: 'stock' },
      })
      expect(config.fields).toContainEqual(
        expect.objectContaining({ name: 'stock', type: 'number' }),
      )
      expect(config.fields).not.toContainEqual(expect.objectContaining({ name: 'inventory' }))
    },
  )
  it.each([createProductsCollection, createVariantsCollection])(
    'should omit inventory when disabled for %s',
    (createCollection) => {
      const config = createCollection({ access, currenciesConfig, inventory: false })
      expect(config.fields).not.toContainEqual(expect.objectContaining({ name: 'inventory' }))
    },
  )
})
