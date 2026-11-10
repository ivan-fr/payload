import type { ClientConfig } from 'payload'

/** Localized writes must disable fallback; unlocalized requests need no fallback parameter. */
export const getFallbackLocaleQuery = ({
  localization,
}: {
  localization?: ClientConfig['localization']
}): false | undefined => (localization ? false : undefined)
