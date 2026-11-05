import type { I18n } from '@payloadcms/translations'
import type { Field, FieldSchemaMap, SanitizedConfig, TextField } from 'payload'

import { confirmPassword, password } from 'payload/shared'

import { traverseFields } from './traverseFields.js'

const baseAuthFields: Field[] = [
  {
    name: 'password',
    type: 'text',
    required: true,
    validate: password,
  },
  {
    name: 'confirm-password',
    type: 'text',
    required: true,
    validate: confirmPassword,
  },
]

/**
 * Flattens the config fields into a map of field schemas
 */
export const buildFieldSchemaMap = (args: {
  collectionSlug?: string
  config: SanitizedConfig
  globalSlug?: string
  i18n: I18n
  widgetSlug?: string
}): { fieldSchemaMap: FieldSchemaMap } => {
  const { collectionSlug, config, globalSlug, i18n, widgetSlug } = args

  const schemaMap: FieldSchemaMap = new Map()

  if (collectionSlug) {
    const matchedCollection = config.collections.find(
      (collection) => collection.slug === collectionSlug,
    )

    if (matchedCollection) {
      let fieldsToSet = matchedCollection?.fields || []

      if (matchedCollection.auth && !matchedCollection.auth.disableLocalStrategy) {
        const authFields: Field[] = [
          { ...(baseAuthFields[0] as TextField), label: i18n.t('general:password') },
          {
            ...(baseAuthFields[1] as TextField),
            label: i18n.t('authentication:confirmPassword'),
          },
        ]
        // Keep fields owned by other cached languages unchanged.
        fieldsToSet = fieldsToSet.concat(authFields)
      }

      schemaMap.set(collectionSlug, {
        fields: fieldsToSet,
      })

      traverseFields({
        config,
        fields: fieldsToSet,
        i18n,
        parentIndexPath: '',
        parentSchemaPath: collectionSlug,
        schemaMap,
      })
    }
  } else if (globalSlug) {
    const matchedGlobal = config.globals.find((global) => global.slug === globalSlug)

    if (matchedGlobal) {
      schemaMap.set(globalSlug, {
        fields: matchedGlobal.fields,
      })

      traverseFields({
        config,
        fields: matchedGlobal.fields,
        i18n,
        parentIndexPath: '',
        parentSchemaPath: globalSlug,
        schemaMap,
      })
    }
  } else if (widgetSlug) {
    const matchedWidget = config.admin?.dashboard?.widgets?.find(
      (widget) => widget.slug === widgetSlug,
    )
    const widgetFields = matchedWidget?.fields

    if (widgetFields?.length) {
      schemaMap.set(widgetSlug, {
        fields: widgetFields,
      })

      traverseFields({
        config,
        fields: widgetFields,
        i18n,
        parentIndexPath: '',
        parentSchemaPath: widgetSlug,
        schemaMap,
      })
    }
  }

  return { fieldSchemaMap: schemaMap }
}
