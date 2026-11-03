import type { Config } from 'payload'

import { randomUUID } from 'node:crypto'

import { en } from '@payloadcms/translations/languages/en'
import { fr } from '@payloadcms/translations/languages/fr'
import { describe, expect, it } from 'vitest'

import { ecommercePlugin } from '../index.js'
import { translations } from './index.js'

const applyPlugin = (config: Config) =>
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess: () => true,
      adminOrPublishedStatus: () => true,
      isAdmin: () => true,
      isCustomer: () => false,
      isDocumentOwner: () => false,
    },
    customers: { slug: 'users' },
    products: false,
    carts: false,
    orders: false,
    transactions: false,
  })(config)

describe('ecommerce translation overrides (#16502)', () => {
  it('should preserve user namespace overrides, unrelated keys and plugin defaults', async () => {
    const result = await applyPlugin({
      secret: randomUUID(),
      i18n: {
        supportedLanguages: { en, fr },
        translations: {
          fr: {
            'plugin-ecommerce': { cart: 'Mon panier personnel' },
            general: { save: 'Enregistrer autrement' },
          },
        },
      },
    })
    const french = result.i18n!.translations!.fr as Record<string, Record<string, unknown>>

    expect(french['plugin-ecommerce'].cart).toBe('Mon panier personnel')
    expect(french['plugin-ecommerce'].variantOptionsRequired).toBe(
      translations.fr.translations['plugin-ecommerce'].variantOptionsRequired,
    )
    expect(french.general.save).toBe('Enregistrer autrement')
    expect(Object.keys(result.i18n!.translations!).sort()).toEqual(['en', 'fr'])
  })

  it('should supply English defaults when supportedLanguages is omitted', async () => {
    const result = await applyPlugin({ secret: randomUUID() })

    expect(result.i18n!.translations!.en).toEqual({
      'plugin-ecommerce': translations.en.translations['plugin-ecommerce'],
    })
    expect(Object.keys(result.i18n!.translations!)).toEqual(['en'])
  })
})
