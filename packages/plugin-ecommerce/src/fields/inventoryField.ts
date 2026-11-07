import type { NumberField } from 'payload'

type Props = {
  fieldName?: string
  overrides?: Partial<NumberField>
}

export const inventoryField: (props?: Props) => NumberField = (props) => {
  const { fieldName = 'inventory', overrides } = props || {}

  // @ts-expect-error - issue with payload types
  const field: NumberField = {
    name: fieldName,
    type: 'number',
    defaultValue: 0,
    // @ts-expect-error - translations are not typed in plugins yet
    label: ({ t }) => t('plugin-ecommerce:inventory'),
    min: 0,
    ...(overrides || {}),
  }

  return field
}
