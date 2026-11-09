/** Collect public response messages once, preserving their order. */
export const getUniqueErrorMessages = ({
  errors,
  fallback,
}: {
  errors: unknown
  fallback?: string
}): string[] => {
  const messages = Array.isArray(errors)
    ? [
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
    : []
  if (messages.length === 0 && fallback) {
    return [fallback]
  }
  return messages
}
