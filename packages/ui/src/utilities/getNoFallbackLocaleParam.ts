import type { ClientConfig } from 'payload'

/**
 * The admin panel reads and writes documents without locale fallback, so that a fallback value
 * is never saved into the locale being edited. The `fallback-locale` param only means something
 * when localization is configured. Without localization it is left out of the URL entirely.
 *
 * @returns the `fallback-locale` query param value, or `undefined` when the param should be omitted
 */
export const getNoFallbackLocaleParam = ({
  localization,
}: {
  localization: ClientConfig['localization'] | undefined
}): 'null' | undefined => (localization ? 'null' : undefined)
