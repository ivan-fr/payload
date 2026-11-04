import type { FilterOptionsProps, SingleRelationshipField } from 'payload'

import { createPayloadRequest } from 'payload'
import { expect, vi } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { pagesSlug, restrictedSlug, settingsSlug, unrelatedSlug } from './slugs.js'

const text = (value: string) => ({
  type: 'text',
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const message = (children: unknown[]) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    direction: null,
    version: 1,
    children: [{ type: 'paragraph', format: '', indent: 0, direction: null, version: 1, children }],
  },
})

test.suite('Server regressions batch 10', { config: './config.ts' }, () => {
  test.afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should exclude every descendant from the real parent query (#17658)', async ({
    payload,
  }) => {
    const root = await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { title: 'Root' },
    })
    const child = await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { title: 'Child', parent: root.id },
    })
    await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { title: 'Grandchild', parent: child.id },
    })
    const sibling = await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { title: 'Sibling' },
    })
    const req = await createPayloadRequest({ payload })
    const parent = payload.collections[pagesSlug]!.config.fields.find(
      (field) => 'name' in field && field.name === 'parent',
    ) as SingleRelationshipField
    if (typeof parent.filterOptions !== 'function') throw new Error('Expected a parent filter')
    const where = await parent.filterOptions({
      id: root.id,
      relationTo: pagesSlug,
      req,
    } as FilterOptionsProps)
    if (typeof where !== 'object' || !where) throw new Error('Expected a subtree filter')
    const candidates = await payload.find({
      collection: pagesSlug,
      where,
      depth: 0,
      pagination: false,
    })
    expect(candidates.docs.map((doc) => doc.id)).toEqual([sibling.id])
  })

  test('should reject a cyclic reparent and retain the persisted tree (#16517)', async ({
    payload,
  }) => {
    const root = await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { title: 'Root' },
    })
    const child = await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { title: 'Child', parent: root.id },
    })
    // Bypass field validation to exercise the hook's independent cycle guard.
    const beforeChange = payload.collections[pagesSlug]!.config.hooks.beforeChange![0]!
    const req = await createPayloadRequest({ payload })
    await expect(
      beforeChange({
        collection: payload.collections[pagesSlug]!.config,
        data: { parent: child.id },
        originalDoc: root,
        operation: 'update',
        req,
        context: {},
      } as never),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('cycle') })
    expect(
      (await payload.findByID({ collection: pagesSlug, id: root.id, depth: 0 })).parent,
    ).toBeFalsy()
  })

  test('should send all configured emails when one contains a numeric internal link (#19253)', async ({
    payload,
  }) => {
    const page = await payload.create({
      overrideAccess: true,
      collection: pagesSlug,
      data: { title: 'Linked page' },
    })
    const link = {
      type: 'link',
      version: 3,
      format: '',
      indent: 0,
      direction: null,
      fields: { linkType: 'internal', doc: { relationTo: pagesSlug, value: page.id } },
      children: [text('Read page')],
    }
    const form = await payload.create({
      overrideAccess: true,
      collection: 'forms',
      data: {
        title: 'Email form',
        fields: [],
        confirmationType: 'message',
        confirmationMessage: message([text('Thanks')]) as never,
        emails: [
          {
            emailFrom: 'from@example.com',
            emailTo: 'to@example.com',
            subject: 'Plain',
            message: message([text('Hello')]) as never,
          },
          {
            emailFrom: 'from@example.com',
            emailTo: 'to@example.com',
            subject: 'Linked',
            message: message([link]) as never,
          },
        ],
      },
    })
    const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
    await payload.create({
      overrideAccess: true,
      collection: 'form-submissions',
      data: { form: form.id, submissionData: [{ field: 'name', value: 'Alice' }] },
    })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Linked',
        html: expect.stringContaining(`href="${page.id}"`),
      }),
    )
  })

  test('should send table email markup without a paragraph wrapper (#14328)', async ({
    payload,
  }) => {
    const form = await payload.create({
      overrideAccess: true,
      collection: 'forms',
      data: {
        title: 'Table form',
        fields: [],
        confirmationType: 'message',
        confirmationMessage: message([text('Thanks')]) as never,
        emails: [
          {
            emailFrom: 'from@example.com',
            emailTo: 'to@example.com',
            subject: 'Table',
            message: message([text('Before {{*:table}} after')]) as never,
          },
        ],
      },
    })
    const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
    await payload.create({
      overrideAccess: true,
      collection: 'form-submissions',
      data: { form: form.id, submissionData: [{ field: 'name', value: 'Alice' }] },
    })
    expect(send).toHaveBeenCalledTimes(1)
    const html = send.mock.calls[0]![0].html as string
    expect(html).toContain('<div>Before <table>')
    expect(html).not.toContain('<p>')
    expect(html).toContain('</table> after</div>')
  })

  test('should generate all SEO values for manual global fields without duplicating them (#18311)', async ({
    payload,
    restClient,
  }) => {
    await payload.create({
      overrideAccess: true,
      collection: 'users',
      data: { email: 'admin@example.com', password: 'test' },
    })
    await restClient.login({
      slug: 'users',
      credentials: { email: 'admin@example.com', password: 'test' },
    })
    const expected = {
      title: 'Generated title',
      description: 'Generated description',
      url: 'https://example.com',
      image: 'image-id',
    }
    for (const [kind, result] of Object.entries(expected)) {
      const response = await restClient.POST(`/plugin-seo/generate-${kind}`, {
        body: JSON.stringify({ globalSlug: settingsSlug, doc: { meta: { title: 'Keep' } } }),
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ result })
    }
    expect(
      payload.config.globals
        .find((g) => g.slug === settingsSlug)!
        .fields.filter((field) => 'name' in field && field.name === 'meta'),
    ).toHaveLength(1)
  })

  test('should retain SEO authentication and target access checks (#18311)', async ({
    payload,
    restClient,
  }) => {
    const anonymous = await restClient.POST('/plugin-seo/generate-title', {
      body: JSON.stringify({ globalSlug: settingsSlug }),
    })
    expect(anonymous.status).toBe(401)
    await payload.create({
      overrideAccess: true,
      collection: 'users',
      data: { email: 'admin@example.com', password: 'test' },
    })
    await restClient.login({
      slug: 'users',
      credentials: { email: 'admin@example.com', password: 'test' },
    })
    for (const slug of [restrictedSlug, unrelatedSlug]) {
      const response = await restClient.POST('/plugin-seo/generate-title', {
        body: JSON.stringify({ globalSlug: slug }),
      })
      expect(response.status).toBe(403)
    }
  })
})
