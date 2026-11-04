import { APIError } from 'payload'

export const SAFE_STRING_REGEX =
  /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}_ @.\-+:\u200D]*$/u

export const escapeSQLValue = (value: unknown): boolean | null | number | string => {
  if (value === null) {
    return null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid value type')
  }

  if (!SAFE_STRING_REGEX.test(value)) {
    throw new APIError(`${value} is not allowed as a JSON query value`, 400)
  }

  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  return escaped
}
