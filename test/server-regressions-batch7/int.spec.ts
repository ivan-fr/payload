import type { Field } from 'payload'

import { expect } from 'vitest'

import { traverseFields } from '../../packages/payload/src/utilities/traverseFields.js'
import { test } from '../__helpers/int/vitest.js'
import { localizedSlug, productsSlug, variantsSlug } from './slugs.js'

test.suite('Server regressions batch 7', { config: './config.ts' }, () => {
  test('should create and validate variants when trash is disabled (#16367)', async ({
    payload,
  }) => {
    const product = await payload.create({
      collection: productsSlug,
      data: { title: 'Shirt', variantTypes: ['size'] },
    })
    const variant = await payload.create({
      collection: variantsSlug,
      data: { product: product.id, options: ['small'] },
    })

    expect(variant.options).toEqual(['small'])
    await expect(
      payload.create({
        collection: variantsSlug,
        data: { product: product.id, options: ['small'] },
      }),
    ).rejects.toThrow()
    const large = await payload.create({
      collection: variantsSlug,
      data: { product: product.id, options: ['large'] },
    })
    expect(large.id).not.toBe(variant.id)
  })

  test('should ignore legacy missing options while retaining duplicate detection (#16368)', async ({
    payload,
  }) => {
    const product = await payload.create({
      collection: productsSlug,
      data: { title: 'Shirt', variantTypes: ['size'] },
    })
    await payload.db.create({
      collection: variantsSlug,
      data: { product: product.id, options: null },
    })
    const variant = await payload.create({
      collection: variantsSlug,
      data: { product: product.id, options: ['small'] },
    })

    expect(variant.options).toEqual(['small'])
    await expect(
      payload.create({
        collection: variantsSlug,
        data: { product: product.id, options: ['small'] },
      }),
    ).rejects.toThrow()
  })

  test('should return a translated duplicate error in the real REST response (#19021)', async ({
    payload,
    restClient,
  }) => {
    const product = await payload.create({
      collection: productsSlug,
      data: { title: 'Shirt', variantTypes: ['size'] },
    })
    await payload.create({
      collection: variantsSlug,
      data: { product: product.id, options: ['small'] },
    })
    const response = await restClient.POST(`/${variantsSlug}`, {
      body: JSON.stringify({ product: product.id, options: ['small'] }),
    })

    expect(response.status).toBe(400)
    const result = await response.json()
    expect(result).toMatchObject({
      errors: [
        {
          name: 'ValidationError',
          data: {
            collection: variantsSlug,
            errors: [
              {
                path: 'options',
                message:
                  'This variant combo is already in use by another variant. Please select different options.',
              },
            ],
          },
        },
      ],
    })
    expect(JSON.stringify(result)).not.toContain('ecommerce:variantOptionsAlreadyExists')
  })

  test('should omit all joins through real REST reads using joins=false (#17929)', async ({
    payload,
    restClient,
  }) => {
    const product = await payload.create({
      collection: productsSlug,
      data: { title: 'Shirt', variantTypes: ['size'] },
    })
    await payload.db.create({
      collection: variantsSlug,
      data: { product: product.id, options: ['small'] },
    })
    const regularResponse = await restClient.GET(`/${productsSlug}/${product.id}`)
    const regular = await regularResponse.json()

    expect(regularResponse.status).toBe(200)
    expect(regular.variants.docs).toHaveLength(1)
    const suppressedResponse = await restClient.GET(`/${productsSlug}/${product.id}?joins=false`)
    expect(suppressedResponse.status).toBe(200)
    expect((await suppressedResponse.json()).variants).toBeUndefined()
    const listResponse = await restClient.GET(`/${productsSlug}?joins=false`)
    expect(listResponse.status).toBe(200)
    expect((await listResponse.json()).docs[0].variants).toBeUndefined()
  })

  test('should traverse persisted locale-resolved groups and tabs explicitly (#18217)', async ({
    payload,
  }) => {
    const doc = await payload.create({
      collection: localizedSlug,
      locale: 'en',
      data: { legal: { notice: 'Legal' }, details: { note: 'Detail' } },
    })
    await payload.update({
      collection: localizedSlug,
      id: doc.id,
      locale: 'fr',
      data: { legal: { notice: 'Mentions' }, details: { note: 'Détail' } },
    })
    const resolved = await payload.findByID({ collection: localizedSlug, id: doc.id, locale: 'fr' })
    const fields = payload.collections[localizedSlug]!.config.fields as Field[]
    const seen: Record<string, unknown> = {}

    traverseFields({
      fields,
      fillEmpty: false,
      flattenLocales: true,
      ref: resolved,
      callback: ({ field, parentPath, ref }) => {
        if (field.type === 'text' && (field.name === 'notice' || field.name === 'note'))
          seen[parentPath + field.name] = (ref as Record<string, unknown>)[field.name]
      },
    })
    expect(seen).toEqual({ 'legal.notice': 'Mentions', 'details.note': 'Détail' })
  })
})
