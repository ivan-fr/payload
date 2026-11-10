import { getUniqueErrorMessages } from './getUniqueErrorMessages.js'

export const getResponseErrorMessage = async ({
  fallback,
  response,
}: {
  fallback: string
  response: Response
}): Promise<string> => {
  try {
    const json: unknown = await response.json()
    if (json && typeof json === 'object') {
      const errors = 'errors' in json ? json.errors : [json]
      return getUniqueErrorMessages({ errors }).join('\n') || fallback
    }
  } catch {
    // Non-JSON responses still need a useful, safe error message.
  }
  return fallback
}
