import type { FieldHook } from 'payload'

/** A fallback locale may contribute breadcrumb IDs already owned by another locale. */
export const ensureUniqueBreadcrumbIDs: FieldHook = ({
  field,
  req,
  siblingDocWithLocales,
  value,
}) => {
  if (!field.localized || !('name' in field) || !Array.isArray(value) || req.locale === 'all') {
    return value
  }

  const stored = siblingDocWithLocales?.[field.name]
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return value
  }

  const otherLocaleIDs = new Set<string>()
  for (const [locale, rows] of Object.entries(stored)) {
    if (locale !== req.locale && Array.isArray(rows)) {
      for (const row of rows) {
        if (row?.id != null) {
          otherLocaleIDs.add(String(row.id))
        }
      }
    }
  }

  return value.map((row) => {
    if (row?.id != null && otherLocaleIDs.has(String(row.id))) {
      const { id: _id, ...withoutID } = row
      return withoutID
    }
    return row
  })
}
