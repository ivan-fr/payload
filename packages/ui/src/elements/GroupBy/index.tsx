'use client'
import type { ClientField, SanitizedCollectionConfig } from 'payload'

import React, { useMemo } from 'react'

import { ChevronIcon } from '../../icons/Chevron/index.js'
import { useAuth } from '../../providers/Auth/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { getGroupByFieldPaths } from '../../utilities/getGroupByFieldPaths.js'
import { reduceFieldsToOptions } from '../../utilities/reduceFieldsToOptions.js'
import { Button } from '../Button/index.js'
import { Popup } from '../Popup/index.js'
import { GroupByPopup } from './Popup.js'

export type GroupByButtonProps = {
  readonly collectionSlug: SanitizedCollectionConfig['slug']
  readonly fields: ClientField[]
  /** Called with the next `groupBy` value (prefixed with `-` for descending). */
  readonly onChange: (groupBy: string) => void
  /** The current `groupBy` value (prefixed with `-` for descending). */
  readonly value: string
}

const baseClass = 'group-by-control'

export const GroupByButton: React.FC<GroupByButtonProps> = ({
  collectionSlug,
  fields,
  onChange,
  value,
}) => {
  const { i18n, t } = useTranslation()
  const { permissions } = useAuth()

  const groupByFieldName = value?.replace(/^-/, '')

  const fieldPermissions = permissions?.collections?.[collectionSlug]?.fields

  const reducedFields = useMemo(
    () =>
      reduceFieldsToOptions({
        fieldPermissions,
        fields,
        i18n,
      }),
    [fields, fieldPermissions, i18n],
  )

  const filteredFields = useMemo(() => {
    const supportedPaths = getGroupByFieldPaths({ fields })
    return reducedFields.filter((field) => supportedPaths.has(field.fieldPath))
  }, [fields, reducedFields])

  const groupByField = filteredFields.find((field) => field.fieldPath === groupByFieldName)
  const isActive = Boolean(groupByFieldName && groupByField)

  if (filteredFields.length === 0) {
    return null
  }

  const triggerLabel = isActive
    ? t('general:groupByLabel', { label: groupByField?.plainTextLabel || '' })
    : t('general:groupByLabel', { label: '' })

  return (
    <Popup
      className={baseClass}
      horizontalAlign="right"
      popupAriaLabel={triggerLabel}
      popupType="dialog"
      portalClassName={`${baseClass}__popup`}
      render={({ close }) => (
        <GroupByPopup
          close={close}
          filteredFields={filteredFields}
          groupByField={groupByField}
          groupByFieldName={groupByFieldName}
          isActive={isActive}
          onChange={onChange}
          value={value}
        />
      )}
      renderButton={({ active, onClick, onKeyDown, ...ariaProps }) => (
        <Button
          buttonStyle="secondary"
          className={`${baseClass}__trigger`}
          extraButtonProps={{ onKeyDown }}
          icon={<ChevronIcon direction={active ? 'up' : 'down'} size={16} />}
          id="toggle-group-by"
          onClick={onClick}
          selected={active || isActive}
          size="medium"
          {...ariaProps}
        >
          {triggerLabel}
        </Button>
      )}
      size="large"
      theme="auto"
      verticalAlign="bottom"
    />
  )
}
