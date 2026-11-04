import type { SlashMenuGroup } from './LexicalTypeaheadMenuPlugin/types.js'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sanitizeClientFeatures } from '../../config/client/sanitize.js'

const fixture = vi.hoisted(() => ({
  query: null as null | string,
  groups: [] as SlashMenuGroup[],
  dynamicGroups: [] as Array<(args: unknown) => SlashMenuGroup[]>,
  renderedGroups: [] as SlashMenuGroup[],
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: () => [fixture.query, vi.fn()],
}))
vi.mock('@lexical/react/LexicalComposerContext.js', () => ({
  useLexicalComposerContext: () => [{}],
}))
vi.mock('@payloadcms/ui', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }))
vi.mock('../../config/client/EditorConfigProvider.js', () => ({
  useEditorConfigContext: () => ({
    editorConfig: {
      features: { slashMenu: { groups: fixture.groups, dynamicGroups: fixture.dynamicGroups } },
    },
    fieldProps: { featureClientSchemaMap: {}, schemaPath: 'posts.content' },
  }),
}))
vi.mock('./LexicalTypeaheadMenuPlugin/index.js', () => ({
  LexicalTypeaheadMenuPlugin: ({ groups }: { groups: SlashMenuGroup[] }) => {
    fixture.renderedGroups = groups
    return null
  },
}))
vi.mock('./useMenuTriggerMatch.js', () => ({ useMenuTriggerMatch: () => vi.fn() }))

import { SlashMenuPlugin } from './index.js'

const group = ({ key, items }: { key: string; items: string[] }): SlashMenuGroup => ({
  key,
  items: items.map((key) => ({ key, Icon: () => null, onSelect: () => {} })),
})
const renderMenu = () =>
  renderToStaticMarkup(createElement(SlashMenuPlugin, { anchorElem: {} as HTMLElement }))

describe('Dynamic slash groups (#19317)', () => {
  beforeEach(() => {
    fixture.query = 'a'
    fixture.groups = [
      group({ key: 'basic', items: ['alpha'] }),
      group({ key: 'other', items: ['gamma'] }),
    ]
    fixture.dynamicGroups = [
      () => [group({ key: 'basic', items: ['dynamic'] }), group({ key: 'new', items: ['added'] })],
    ]
  })

  it('should merge dynamic items in place without changing or duplicating configured static items', () => {
    const original = structuredClone(
      fixture.groups.map(({ key, items }) => ({ key, keys: items.map(({ key }) => key) })),
    )
    renderMenu()
    expect(fixture.renderedGroups.map(({ key }) => key)).toEqual(['basic', 'other', 'new'])
    expect(fixture.renderedGroups[0]!.items.map(({ key }) => key)).toEqual(['alpha', 'dynamic'])
    expect(fixture.renderedGroups[2]!.items.map(({ key }) => key)).toEqual(['added'])
    renderMenu()
    expect(
      fixture.groups.map(({ key, items }) => ({ key, keys: items.map(({ key }) => key) })),
    ).toEqual(original)
  })

  it('should offer dynamic items for a bare slash with an empty query', () => {
    fixture.query = ''
    renderMenu()
    expect(fixture.renderedGroups[0]!.items.map(({ key }) => key)).toEqual(['alpha', 'dynamic'])
  })

  it('should not invoke dynamic callbacks when the menu has no query', () => {
    fixture.query = null
    const dynamic = vi.fn(() => [])
    fixture.dynamicGroups = [dynamic]
    renderMenu()
    expect(dynamic).not.toHaveBeenCalled()
  })

  it('should register a zero-argument dynamic callback without requiring static groups', () => {
    const dynamicGroups = () => [group({ key: 'new', items: ['added'] })]
    const result = sanitizeClientFeatures(
      new Map([['custom', { key: 'custom', order: 0, slashMenu: { dynamicGroups } }]]) as never,
    )
    expect(result.slashMenu.dynamicGroups).toEqual([dynamicGroups])
    expect(result.slashMenu.groups).toEqual([])
  })
})
