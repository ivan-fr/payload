import type { Payload, PayloadRequest } from 'payload'

import { fieldSchemasToFormState } from '@payloadcms/ui/forms/fieldSchemasToFormState'
import { schedulePublishHandler } from '@payloadcms/ui/utilities/schedulePublishHandler'
import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { postsSlug, usersSlug } from './slugs.js'

const body = (children: unknown[]) =>
  ({
    root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children },
  }) as never
const paragraph = {
  type: 'paragraph',
  version: 1,
  direction: null,
  format: '',
  indent: 0,
  children: [
    { type: 'text', version: 1, text: 'Content', format: 0, mode: 'normal', style: '', detail: 0 },
  ],
}
const setup = async ({ payload }: { payload: Payload }) => {
  const editor = await payload.create({
    collection: usersSlug,
    overrideAccess: true,
    data: { email: 'editor@example.com', password: 'test', role: 'editor' },
  })
  const viewer = await payload.create({
    collection: usersSlug,
    overrideAccess: true,
    data: { email: 'viewer@example.com', password: 'test', role: 'viewer' },
  })
  const post = await payload.create({
    collection: postsSlug,
    overrideAccess: true,
    draft: true,
    data: { title: 'Draft', owner: editor.id, body: body([paragraph]) },
  })
  const editorReq = await createPayloadRequest({
    payload,
    user: { ...editor, collection: usersSlug },
  })
  const viewerReq = await createPayloadRequest({
    payload,
    user: { ...viewer, collection: usersSlug },
  })
  return { editorReq, viewerReq, post, viewer }
}
const schedule = ({ req, id }: { req: PayloadRequest; id: number | string }) =>
  schedulePublishHandler({
    type: 'publish',
    date: new Date('2030-01-02T12:00:00Z'),
    doc: { relationTo: postsSlug, value: String(id) },
    cookies: new Map(),
    importMap: req.payload.importMap,
    locale: undefined,
    permissions: { canAccessAdmin: true },
    req,
    user: req.user,
  })

test.suite('Server regressions batch 16', { config: './config.ts' }, () => {
  test('should reject scheduling and cancellation for a user denied target updates (#19192)', async ({
    payload,
  }) => {
    const { editorReq, viewerReq, post } = await setup({ payload })
    expect(await schedule({ req: viewerReq, id: post.id })).toHaveProperty('error')
    expect(
      (await payload.find({ collection: 'payload-jobs', overrideAccess: true })).totalDocs,
    ).toBe(0)
    expect(await schedule({ req: editorReq, id: post.id })).toHaveProperty('message')
    const job = (await payload.find({ collection: 'payload-jobs', overrideAccess: true })).docs[0]!
    expect(
      await schedulePublishHandler({ deleteID: job.id, req: viewerReq } as never),
    ).toHaveProperty('error')
    expect(
      await payload.findByID({ collection: 'payload-jobs', id: job.id, overrideAccess: true }),
    ).toBeDefined()
    expect(
      await schedulePublishHandler({ deleteID: job.id, req: editorReq } as never),
    ).toHaveProperty('message')
    expect(
      (await payload.find({ collection: 'payload-jobs', overrideAccess: true })).totalDocs,
    ).toBe(0)
  })

  test('should enforce row-level ownership when scheduling (#19192)', async ({ payload }) => {
    const { editorReq, viewer } = await setup({ payload })
    const other = await payload.create({
      collection: postsSlug,
      overrideAccess: true,
      draft: true,
      data: { title: 'Other owner', owner: viewer.id, body: body([paragraph]) },
    })
    expect(await schedule({ req: editorReq, id: other.id })).toHaveProperty('error')
    expect(
      (await payload.find({ collection: 'payload-jobs', overrideAccess: true })).totalDocs,
    ).toBe(0)
  })

  for (const [label, node] of [
    ['line break', { ...paragraph, children: [{ type: 'linebreak', version: 1 }] }],
    [
      'empty heading',
      {
        type: 'heading',
        version: 1,
        tag: 'h2',
        direction: null,
        format: '',
        indent: 0,
        children: [],
      },
    ],
  ] as const) {
    test(`should reject required rich text containing only a ${label} (#19227)`, async ({
      payload,
    }) => {
      const editor = await payload.create({
        collection: usersSlug,
        overrideAccess: true,
        data: { email: 'editor@example.com', password: 'test', role: 'editor' },
      })
      await expect(
        payload.create({
          collection: postsSlug,
          overrideAccess: true,
          data: { title: 'Empty', owner: editor.id, body: body([node]) },
        }),
      ).rejects.toMatchObject({ name: 'ValidationError', status: 400 })
      expect((await payload.find({ collection: postsSlug, overrideAccess: true })).totalDocs).toBe(
        0,
      )
    })
  }

  test('should supply array validation paths while building form state (#18873)', async ({
    payload,
  }) => {
    const req = await createPayloadRequest({ payload })
    const state = await fieldSchemasToFormState({
      collectionSlug: postsSlug,
      schemaPath: postsSlug,
      fields: payload.collections[postsSlug].config.fields.filter(
        (f) => 'name' in f && f.name === 'items',
      ),
      fieldSchemaMap: undefined,
      permissions: {},
      preferences: { fields: {} },
      renderAllFields: false,
      req,
      data: { items: [{ id: 'row', text: 'value' }] },
    })
    expect(state['items.0.text']).toMatchObject({ value: 'value' })
    expect(state['items.0.text']).not.toHaveProperty('errorMessage')
  })
})
