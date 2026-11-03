import type { Validate } from 'payload'

type Props = {
  productsCollectionSlug?: string
}

export const validateOptions: (props?: Props) => Validate =
  (props) =>
  async (values, { data, req }) => {
    const { productsCollectionSlug = 'products' } = props || {}
    const { t } = req

    if (!values || values.length === 0) {
      // @ts-expect-error - TODO: Fix types
      return t('plugin-ecommerce:variantOptionsRequired')
    }

    const productID = data.product

    if (!productID) {
      // @ts-expect-error - TODO: Fix types
      return t('plugin-ecommerce:productRequired')
    }

    const product = await req.payload.findByID({
      id: productID,
      collection: productsCollectionSlug,
      depth: 1,
      draft: true,
      joins: {
        variants: {
          where: {
            ...(data.id && {
              id: {
                not_equals: data.id, // exclude the current variant from the search
              },
            }),
          },
        },
      },
      overrideAccess: true,
      req,
      select: {
        variants: true,
        variantTypes: true,
      },
      user: req.user,
    })

    // @ts-expect-error - TODO: Fix types
    const variants = product.variants?.docs ?? []

    // @ts-expect-error - TODO: Fix types
    if (values.length < product?.variantTypes?.length) {
      // @ts-expect-error - TODO: Fix types
      return t('plugin-ecommerce:variantOptionsRequiredAll')
    }

    if (variants.length > 0) {
      const existingOptions: (number | string)[][] = []

      variants.forEach((variant: any) => {
        // Draft joins may return the current variant despite the query-level ID filter.
        if (
          Array.isArray(variant.options) &&
          (data.id === undefined || String(variant.id) !== String(data.id))
        ) {
          existingOptions.push(variant.options)
        }
      })

      const exists = existingOptions.some(
        (combo) => combo.length === values.length && combo.every((val) => values.includes(val)),
      )

      if (exists) {
        // @ts-expect-error - TODO: Fix types
        return t('plugin-ecommerce:variantOptionsAlreadyExists')
      }
    }

    return true
  }
