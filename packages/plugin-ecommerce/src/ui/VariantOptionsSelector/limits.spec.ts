import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@payloadcms/ui', () => ({ FieldLabel: () => null }))
vi.mock('./ErrorBox.js', () => ({ ErrorBox: () => null }))
vi.mock('./OptionsSelect.js', () => ({ OptionsSelect: () => null }))

import { VariantOptionsSelector } from './index.js'
import { OptionsSelect } from './OptionsSelect.js'
import { ErrorBox } from './ErrorBox.js'

const elements = ({
  node,
}: {
  node: React.ReactNode
}): React.ReactElement<Record<string, unknown>>[] => {
  const found: React.ReactElement<Record<string, unknown>>[] = []
  React.Children.forEach(node, (child) => {
    if (React.isValidElement<Record<string, unknown>>(child)) {
      found.push(child, ...elements({ node: child.props.children as React.ReactNode }))
    }
  })
  return found
}

describe('variant selector completeness (#18498)', () => {
  it('should offer every option and include every existing combination past ten', async () => {
    const options = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, label: `Option ${i + 1}` }))
    const variants = Array.from({ length: 12 }, (_, i) => ({ options: [i + 1] }))
    const findByID = vi.fn(async ({ collection, joins }) =>
      collection === 'products'
        ? {
            variantTypes: [1],
            variants: { docs: joins?.variants?.limit === 0 ? variants : variants.slice(0, 10) },
          }
        : {
            name: 'size',
            options: { docs: joins?.options?.limit === 0 ? options : options.slice(0, 10) },
          },
    )
    const tree = await VariantOptionsSelector({
      clientField: { label: 'Options' },
      field: {},
      data: { product: 1 },
      req: { payload: { findByID } },
      path: 'options',
    } as never)
    const children = elements({ node: tree })
    expect(children.find((c) => c.type === OptionsSelect)!.props.options).toHaveLength(12)
    expect(children.find((c) => c.type === ErrorBox)!.props.existingOptions).toHaveLength(12)
  })
})
