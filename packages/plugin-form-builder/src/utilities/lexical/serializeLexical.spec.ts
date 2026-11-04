import { describe, expect, it } from 'vitest'

import { serializeLexical } from './serializeLexical.js'

const message = (children: unknown[]) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children }] },
})
const text = (value: string) => ({ type: 'text', text: value, format: 0 })

describe('form email serialization', () => {
  it.each(['{{*:table}}', 'Before {{*:table}} after'])(
    'should keep generated tables outside paragraphs (#14328): %s',
    async (value) => {
      const html = await serializeLexical(message([text(value)]), [
        { field: 'name', value: '<script>unsafe</script>' },
      ])
      expect(html).toMatch(/^<div>.*<table>/)
      expect(html).not.toContain('<p>')
      expect(html).toContain('&lt;script&gt;unsafe&lt;/script&gt;')
      if (value.startsWith('Before')) expect(html).toMatch(/Before .*<table>.*<\/table> after/)
    },
  )

  it('should retain ordinary paragraph semantics and escaped markup', async () => {
    expect(await serializeLexical(message([text('<table>')]), [])).toBe('<p>&lt;table&gt;</p>')
  })

  it.each([0, 42, 'uuid-document'])(
    'should serialize populated numeric and string internal IDs (#19253): %s',
    async (id) => {
      const html = await serializeLexical(
        message([
          {
            type: 'link',
            fields: { linkType: 'internal', doc: { value: { id } } },
            children: [text('Read page')],
          },
        ]),
        [],
      )
      expect(html).toBe(`<p><a href="${id}">Read page</a></p>`)
    },
  )

  it.each([0, 42, 'uuid-document'])(
    'should serialize unpopulated internal IDs (#19253): %s',
    async (id) => {
      expect(
        await serializeLexical(
          message([
            {
              type: 'link',
              fields: { linkType: 'internal', doc: { value: id } },
              children: [text('Page')],
            },
          ]),
          [],
        ),
      ).toContain(`href="${id}"`)
    },
  )

  it('should keep URL substitution, escaping and dangerous protocol sanitization', async () => {
    const link = {
      type: 'link',
      fields: { linkType: 'custom', url: 'javascript:alert(1)', newTab: true },
      children: [text('Page')],
    }
    const html = await serializeLexical(message([link]), [])
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('rel="noopener noreferrer" target="_blank"')
    link.fields.url = 'https://example.com/{{slug}}'
    expect(await serializeLexical(message([link]), [{ field: 'slug', value: 'page' }])).toContain(
      'href="https://example.com/page"',
    )
  })
})
