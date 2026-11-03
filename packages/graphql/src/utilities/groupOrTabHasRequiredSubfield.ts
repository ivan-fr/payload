import type { Field, Tab } from 'payload'

import { fieldAffectsData } from 'payload/shared'

export const groupOrTabHasRequiredSubfield = (entity: Field | Tab): boolean => {
  if ('hidden' in entity && entity.hidden) {
    return false
  }

  if (('type' in entity && entity.type === 'group') || ('fields' in entity && 'name' in entity)) {
    return entity.fields.some((subField) => {
      return (
        (fieldAffectsData(subField) &&
          !subField.hidden &&
          'required' in subField &&
          subField.required) ||
        groupOrTabHasRequiredSubfield(subField)
      )
    })
  }

  return false
}
