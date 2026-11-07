import type { EcommercePluginConfig, SanitizedEcommercePluginConfig } from '../types/index.js'

import { defaultAddressFields } from '../collections/addresses/defaultAddressFields.js'
import { USD } from '../currencies/index.js'

type Props = {
  pluginConfig: EcommercePluginConfig
}

export const sanitizePluginConfig = ({ pluginConfig }: Props): SanitizedEcommercePluginConfig => {
  const config = {
    ...pluginConfig,
  } as Partial<SanitizedEcommercePluginConfig>

  config.customers ??= {
    slug: 'users',
  }

  if (
    config.addresses === undefined ||
    (typeof config.addresses === 'boolean' && config.addresses === true)
  ) {
    config.addresses = {
      addressFields: defaultAddressFields(),
    }
  } else {
    const addressFields =
      (typeof pluginConfig.addresses === 'object' &&
        typeof pluginConfig.addresses.addressFields === 'function' &&
        pluginConfig.addresses.addressFields({
          defaultFields: defaultAddressFields(),
        })) ||
      defaultAddressFields()

    config.addresses = {
      ...config.addresses,
      addressFields,
    }
  }

  if (!config.currencies) {
    config.currencies = {
      defaultCurrency: 'USD',
      supportedCurrencies: [USD],
    }
  }

  if (pluginConfig.inventory === undefined || pluginConfig.inventory === true) {
    config.inventory = {
      fieldName: 'inventory',
    }
  }

  if (config.carts === undefined) {
    config.carts = {
      allowGuestCarts: true,
    }
  } else if (config.carts === true) {
    config.carts = {
      allowGuestCarts: true,
    }
  } else if (typeof config.carts === 'object' && config.carts.allowGuestCarts === undefined) {
    config.carts.allowGuestCarts = true
  }

  config.orders ??= true
  config.transactions ??= true

  if (config.payments === undefined) {
    config.payments = {
      paymentMethods: [],
    }
  } else if (!config.payments.paymentMethods) {
    config.payments.paymentMethods = []
  }

  if (config.products) {
    if (typeof config.products === 'object' && config.products.variants === undefined) {
      config.products.variants = true
    }
  }

  config.access = {
    isAuthenticated: ({ req }) => Boolean(req?.user),
    publicAccess: () => true,
    ...pluginConfig.access,
  }

  return config as SanitizedEcommercePluginConfig
}
