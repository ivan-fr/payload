import type { Config, Widget } from './types.js'

import { describe, expect, it } from 'vitest'

import { sanitizeConfig } from './sanitize.js'

const configDefaults = {
  db: { defaultIDType: 'text', init: () => {} },
  secret: 'test-secret',
} as unknown as Config

describe('dashboard widget overrides (#16250)', () => {
  it('should retain the configured collections widget exactly once, including thumbnail metadata', () => {
    const widget: Widget = {
      slug: 'collections',
      Component: '/custom/Collections',
      label: 'My collections',
      imageURL: '/collections.png',
      imageAltText: 'Collections preview',
      minWidth: 'small',
    }
    const config = sanitizeConfig({
      ...configDefaults,
      admin: { dashboard: { widgets: [widget] } },
    })
    const matches = config.admin.dashboard.widgets.filter(({ slug }) => slug === 'collections')

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject(widget)
    expect(config.admin.dashboard.widgets.some(({ slug }) => slug === 'activity')).toBe(true)
  })

  it('should retain all default widgets when there is no override', () => {
    const config = sanitizeConfig({ ...configDefaults })
    const slugs = config.admin.dashboard.widgets.map(({ slug }) => slug)

    expect(slugs).toContain('collections')
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
