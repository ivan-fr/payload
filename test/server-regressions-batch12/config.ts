import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { initiatePaymentHandler } from '../../packages/plugin-ecommerce/src/endpoints/initiatePayment.js'
import { translations } from '../../packages/plugin-ecommerce/src/translations/index.js'
import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import {
  Carts,
  currenciesConfig,
  Machines,
  Options,
  Products,
  Transactions,
  Types,
  Users,
  Variants,
} from './collections/index.js'
import { cartsSlug, productsSlug, transactionsSlug, usersSlug, variantsSlug } from './slugs.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export default buildConfigWithDefaults({
  suite: 'server-regressions-batch12',
  disableAutoLogin: true,
  disableMCP: true,
  config: {
    ...(process.env.PAYLOAD_DATABASE === 'sqlite'
      ? {
          db: sqliteAdapter({
            client: {
              url: process.env.SQLITE_URL || process.env.DATABASE_URL || 'file:./payload.db',
            },
            autoIncrement: true,
            transactionOptions: { behavior: 'immediate' },
          }),
        }
      : {}),
    admin: { user: usersSlug },
    i18n: { translations: { en: translations.en!.translations } },
    collections: [Products, Variants, Types, Options, Carts, Transactions, Users, Machines],
    endpoints: [
      {
        path: '/batch12/initiate',
        method: 'post',
        handler: initiatePaymentHandler({
          cartsSlug,
          currenciesConfig,
          customersSlug: usersSlug,
          productsSlug,
          transactionsSlug,
          variantsSlug,
          productsValidation: async () => {},
          paymentMethod: {
            name: 'test',
            label: 'Test',
            group: { name: 'test', type: 'group', fields: [] },
            confirmOrder: async () => ({ message: 'Unused', orderID: 1, transactionID: 1 }),
            initiatePayment: async ({ data, req }) => ({
              message: 'Initiated',
              customerEmail: data.customerEmail,
              principal: req.user?.collection,
            }),
          },
        }),
      },
    ],
    typescript: { autoGenerate: false, outputFile: path.resolve(dirname, 'payload-types.ts') },
  },
})
