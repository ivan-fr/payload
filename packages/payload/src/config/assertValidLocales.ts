import { InvalidConfiguration } from '../errors/index.js'

/**
 * Locales are either all strings or all objects with a `code`. An object without a `code` would
 * otherwise only fail much later and far from its cause, e.g. as a `TypeError` while generating
 * types or as queries against an `undefined` locale.
 */
export const assertValidLocales = ({ locales }: { locales: unknown }): void => {
  // An empty list is tolerated, as it always has been. Only the entries are checked.
  if (!Array.isArray(locales) || locales.length === 0) {
    return
  }

  const shouldBeStrings = typeof locales[0] === 'string'

  locales.forEach((locale, index) => {
    if (shouldBeStrings) {
      if (typeof locale !== 'string' || !locale) {
        throw new InvalidConfiguration(
          `localization.locales[${index}] must be a non-empty string, because the first locale is a string. Locales cannot mix strings and objects.`,
        )
      }

      return
    }

    const code = typeof locale === 'object' && locale !== null ? (locale as LocaleLike).code : null

    if (typeof code !== 'string' || !code) {
      const hasValueKey =
        typeof locale === 'object' &&
        locale !== null &&
        typeof (locale as LocaleLike).value === 'string'

      throw new InvalidConfiguration(
        `localization.locales[${index}] is missing a "code". Locale objects are defined as { code: 'en', label: 'English' }.${
          hasValueKey ? ' Found a "value" key, did you mean "code"?' : ''
        }`,
      )
    }
  })
}

type LocaleLike = {
  code?: unknown
  value?: unknown
}
