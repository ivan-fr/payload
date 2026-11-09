/** Collect public response messages once, preserving their order. */
export const getUniqueErrorMessages = ({ errors }: { errors: unknown }): string[] => {
  if (!Array.isArray(errors)) {
    return []
  }
  return [
    ...new Set(
      errors.flatMap((error: unknown) => {
        if (
          !error ||
          typeof error !== 'object' ||
          ('isPublic' in error && error.isPublic === false)
        ) {
          return []
        }
        return 'message' in error && typeof error.message === 'string' && error.message.trim()
          ? [error.message]
          : []
      }),
    ),
  ]
}
