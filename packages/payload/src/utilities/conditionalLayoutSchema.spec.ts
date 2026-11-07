import type { Field } from '../fields/config/types.js'

import { describe, expect, it } from 'vitest'

import { sanitizeConfig } from '../config/sanitize.js'
import { configToJSONSchema } from './configToJSONSchema.js'
import { flattenAllFields } from './flattenAllFields.js'

const condition = () => false
const headline: Field = { name: 'headline', type: 'text', required: true }
const layouts: Field[] = [
  { type: 'row', admin: { condition }, fields: [headline] },
  { type: 'collapsible', label: 'Conditional', admin: { condition }, fields: [headline] },
  { type: 'group', admin: { condition }, fields: [headline] },
  { type: 'tabs', admin: { condition }, tabs: [{ label: 'Unnamed', fields: [headline] }] },
  { type: 'tabs', tabs: [{ label: 'Unnamed', admin: { condition }, fields: [headline] }] },
]

describe('conditional layout schemas (#17896)', () => {
  it.each(layouts)('should make required descendants optional below $type', (layout) => {
    const config = sanitizeConfig({
      secret: 'test',
      typescript: { generateInputTypes: true },
      collections: [
        { slug: 'posts', fields: [layout], timestamps: false, authorship: false, versions: false },
      ],
    })
    for (const variant of ['input', 'output'] as const) {
      const schema = configToJSONSchema(config, 'text').jsonSchema.$defs![
        variant === 'input' ? 'posts_input' : 'posts'
      ]
      expect(schema.required).not.toContain('headline')
      expect(schema.properties!.headline.type).toEqual(['string', 'null'])
    }
    expect(headline).not.toHaveProperty('hasConditionalParent')
  })
  it('should make the named container optional but retain required children inside it', () => {
    const config = sanitizeConfig({
      secret: 'test',
      typescript: { generateInputTypes: true },
      collections: [
        {
          slug: 'posts',
          fields: [
            { type: 'tabs', admin: { condition }, tabs: [{ name: 'meta', fields: [headline] }] },
          ],
          timestamps: false,
          authorship: false,
          versions: false,
        },
      ],
    })
    const schema = configToJSONSchema(config, 'text').jsonSchema.$defs!.posts
    expect(schema.required).not.toContain('meta')
    expect(schema.properties!.meta.required).toContain('headline')
  })
  it('should keep required children in a conditional named tab unchanged', () => {
    const config = sanitizeConfig({
      secret: 'test',
      typescript: { generateInputTypes: true },
      collections: [
        {
          slug: 'posts',
          fields: [
            { type: 'tabs', tabs: [{ name: 'meta', admin: { condition }, fields: [headline] }] },
          ],
          timestamps: false,
          authorship: false,
          versions: false,
        },
      ],
    })
    const schema = configToJSONSchema(config, 'text').jsonSchema.$defs!.posts
    expect(schema.required).not.toContain('meta')
    expect(schema.properties!.meta.required).toContain('headline')
  })
  it('should not poison the flatten cache when children are reused under conditional layouts', () => {
    const children = [headline]
    const unconditioned = flattenAllFields({ fields: children, cache: true })
    flattenAllFields({ fields: [{ type: 'row', admin: { condition }, fields: children }] })
    const config = sanitizeConfig({
      secret: 'test',
      collections: [
        {
          slug: 'posts',
          versions: false,
          authorship: false,
          fields: [{ type: 'row', admin: { condition }, fields: children }],
        },
      ],
    })
    expect(configToJSONSchema(config, 'text').jsonSchema.$defs!.posts.required).not.toContain(
      'headline',
    )
    expect(flattenAllFields({ fields: children, cache: true })).toBe(unconditioned)
    const plain = sanitizeConfig({
      secret: 'test',
      collections: [{ slug: 'plain', authorship: false, versions: false, fields: children }],
    })
    expect(configToJSONSchema(plain, 'text').jsonSchema.$defs!.plain.required).toContain('headline')
  })
})

it.each(['group', 'array'] as const)(
  'should keep required children inside a conditional layout %s',
  (type) => {
    const config = sanitizeConfig({
      secret: 'test',
      collections: [
        {
          slug: 'posts',
          authorship: false,
          versions: false,
          fields: [
            {
              type: 'row',
              admin: { condition },
              fields: [{ name: 'container', type, required: true, fields: [headline] }],
            },
          ],
        },
      ],
    })
    const schema = configToJSONSchema(config, 'text').jsonSchema.$defs!.posts
    expect(schema.required).not.toContain('container')
    const container = schema.properties!.container
    const child = type === 'array' ? container.items : container
    expect(child.required).toContain('headline')
  },
)
