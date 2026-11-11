import type { SanitizedCollectionConfig } from '../collections/config/types.js'
import type { SanitizedConfig } from '../config/types.js'

/**
 * Whether `user` is the account that `admin.autoLogin` authenticates without credentials.
 *
 * The JWT strategy returns this user for requests that carry no token at all, so the user has no
 * session ID to refresh.
 */
export const isAutoLoginUser = ({
  collectionConfig,
  config,
  user,
}: {
  collectionConfig: SanitizedCollectionConfig
  config: SanitizedConfig
  user: { email?: unknown; username?: unknown }
}): boolean => {
  const autoLogin = config.admin?.autoLogin

  if (
    !autoLogin ||
    typeof autoLogin !== 'object' ||
    autoLogin.prefillOnly ||
    collectionConfig.slug !== config.admin.user
  ) {
    return false
  }

  // Mirrors the JWT strategy, which looks the user up by email and only falls back to username.
  if (autoLogin.email) {
    return typeof user.email === 'string' && user.email === autoLogin.email
  }

  if (autoLogin.username) {
    return typeof user.username === 'string' && user.username === autoLogin.username
  }

  return false
}
