'use client'

import { getTranslation } from '@payloadcms/translations'
import React from 'react'

import type { SelectFilterProps as Props } from './types.js'

import { useEffectEvent } from '../../../../hooks/useEffectEvent.js'
import { useTranslation } from '../../../../providers/Translation/index.js'
import { ReactSelect } from '../../../ReactSelect/index.js'
import { formatOptions } from './formatOptions.js'

export const Select: React.FC<Props> = ({
  disabled,
  field: {
    admin: { placeholder },
  },
  isClearable,
  onChange,
  operator,
  options: optionsFromProps,
  value,
}) => {
  const { i18n } = useTranslation()
  const [options, setOptions] = React.useState(formatOptions(optionsFromProps))

  const isMulti = ['in', 'not_in'].includes(operator)
  let singleValue = value
  if (Array.isArray(value)) {
    singleValue = value[0]
  }
  let valueToRender

  if (isMulti && Array.isArray(value)) {
    valueToRender = value.map((val) => {
      const matchingOption = options.find((option) => option.value === val)
      return {
        label: matchingOption ? getTranslation(matchingOption.label, i18n) : val,
        value: matchingOption?.value ?? val,
      }
    })
  } else if (singleValue) {
    const matchingOption = options.find((option) => option.value === singleValue)
    valueToRender = {
      label: matchingOption ? getTranslation(matchingOption.label, i18n) : singleValue,
      value: matchingOption?.value ?? singleValue,
    }
  }

  const onSelect = React.useCallback(
    (selectedOption) => {
      let newValue

      if (!selectedOption) {
        newValue = null
      } else if (isMulti) {
        if (Array.isArray(selectedOption)) {
          newValue = selectedOption.map((option) => option.value)
        } else {
          newValue = []
        }
      } else {
        newValue = selectedOption.value
      }

      onChange(newValue)
    },
    [isMulti, onChange],
  )

  React.useEffect(() => {
    setOptions(formatOptions(optionsFromProps))
  }, [optionsFromProps])

  const shouldNormalize = !isMulti && Array.isArray(value)
  const normalizeValue = useEffectEvent(() => onChange(singleValue))

  React.useEffect(() => {
    if (shouldNormalize) {
      normalizeValue()
    }
  }, [shouldNormalize, singleValue])

  return (
    <ReactSelect
      disabled={disabled}
      isClearable={isClearable}
      isMulti={isMulti}
      onChange={onSelect}
      options={options.map((option) => ({ ...option, label: getTranslation(option.label, i18n) }))}
      placeholder={placeholder}
      value={valueToRender}
    />
  )
}
