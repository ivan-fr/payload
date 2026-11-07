import type { ProductsValidation } from '../types/index.js'

import { MissingPrice, OutOfStock } from './errorCodes.js'

export const defaultProductsValidation: ProductsValidation = ({
  currenciesConfig,
  currency,
  inventory,
  product,
  quantity = 1,
  variant,
}) => {
  if (!currency) {
    throw new Error('Currency must be provided for product validation.')
  }

  const inventoryField = (inventory && inventory.fieldName) || 'inventory'
  const priceField = `priceIn${currency.toUpperCase()}`

  if (variant) {
    if (!variant[priceField]) {
      throw new Error(`Variant with ID ${variant.id} does not have a price in ${currency}.`)
    }

    if (
      inventory !== false &&
      (variant[inventoryField] === 0 ||
        (variant[inventoryField] && variant[inventoryField] < quantity))
    ) {
      throw new Error(
        `Variant with ID ${variant.id} is out of stock or does not have enough inventory.`,
      )
    }
  } else if (product) {
    // Validate the product's details only if the variant is not provided as it can have its own inventory and price
    if (!product[priceField]) {
      throw new Error(`Product does not have a price in.`, {
        cause: { code: MissingPrice, codes: [product.id, currency] },
      })
    }

    if (
      inventory !== false &&
      (product[inventoryField] === 0 ||
        (product[inventoryField] && product[inventoryField] < quantity))
    ) {
      throw new Error(`Product is out of stock or does not have enough inventory.`, {
        cause: { code: OutOfStock, codes: [product.id] },
      })
    }
  }
}
