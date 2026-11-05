import type { GlobalConfig } from 'payload'

import { settingsSlug } from '../slugs.js'

export const Settings: GlobalConfig = {
  slug: settingsSlug,
  fields: [{ name: 'title', type: 'text' }],
  versions: { drafts: { autosave: true } },
}
