import type { ReactNode } from 'react'

import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

const loadTemplate = ({
  path,
  dependencies,
}: {
  dependencies: Record<string, unknown>
  path: string
}) => {
  const source = fs.readFileSync(
    new URL(`../templates/ecommerce/src/${path}`, import.meta.url),
    'utf8',
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const actualRequire = createRequire(import.meta.url)
  const mod = { exports: {} as Record<string, unknown> }
  vm.runInNewContext(compiled, {
    module: mod,
    exports: mod.exports,
    require: (name: string) => dependencies[name] ?? actualRequire(name),
  })
  return mod.exports
}

const ProductGridItem = loadTemplate({
  path: 'components/ProductGridItem/index.tsx',
  dependencies: {
    'next/link': {
      __esModule: true,
      default: ({ children, href }: { children: ReactNode; href: string }) =>
        React.createElement('a', { href }, children),
    },
    '@/components/Media': { Media: () => null },
    '@/components/Price': {
      Price: ({ amount }: { amount: number }) =>
        React.createElement('span', { 'data-price': amount }, amount),
    },
  },
}).ProductGridItem as React.FC<{ product: Record<string, unknown> }>

const renderProduct = ({ product }: { product: Record<string, unknown> }) =>
  renderToStaticMarkup(
    React.createElement(ProductGridItem, {
      product: { title: 'Product', slug: 'product', ...product },
    }),
  )

describe('enabled storefront prices (#16160)', () => {
  it.each([false, null, undefined])(
    'should omit a stale disabled base price (enabled: %s)',
    (priceInUSDEnabled) => {
      const html = renderProduct({ product: { priceInUSD: 1234, priceInUSDEnabled } })
      expect(html).not.toContain('data-price')
      expect(html).toContain('href="/products/product"')
      expect(html).toContain('Product')
    },
  )
  it('should retain an enabled price', () => {
    expect(renderProduct({ product: { priceInUSD: 1234, priceInUSDEnabled: true } })).toContain(
      'data-price="1234"',
    )
  })
  it('should ignore disabled variants and use the first enabled variant, including free prices', () => {
    expect(
      renderProduct({
        product: {
          priceInUSD: 1234,
          priceInUSDEnabled: false,
          variants: {
            docs: [
              'unpopulated',
              { priceInUSD: 500, priceInUSDEnabled: false },
              { priceInUSD: 0, priceInUSDEnabled: true },
            ],
          },
        },
      }),
    ).toContain('data-price="0"')
  })
  it('should preserve the enabled base price when no variant has enabled pricing', () => {
    expect(
      renderProduct({
        product: {
          priceInUSD: 1234,
          priceInUSDEnabled: true,
          variants: { docs: [{ priceInUSD: 500, priceInUSDEnabled: false }] },
        },
      }),
    ).toContain('data-price="1234"')
  })
  it('should project the enabled flag with the price on the shop page', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const page = loadTemplate({
      path: 'app/(app)/shop/page.tsx',
      dependencies: {
        '@payload-config': { default: {} },
        payload: { getPayload: () => Promise.resolve({ find }) },
        '@/components/Grid': { Grid: () => null },
        '@/components/ProductGridItem': { ProductGridItem },
      },
    }).default as (props: { searchParams: Promise<object> }) => Promise<unknown>
    await page({ searchParams: Promise.resolve({}) })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideAccess: false,
        select: expect.objectContaining({ priceInUSD: true, priceInUSDEnabled: true }),
      }),
    )
  })
})
