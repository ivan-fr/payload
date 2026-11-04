import type { SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'

import { getFileByPath } from 'payload'
import { expect } from 'vitest'

import type { Batch15Post } from './payload-types.js'

import { test } from '../__helpers/int/vitest.js'
import { blocksSlug, mediaSlug, postsSlug } from './slugs.js'

const content = ({
  nodes,
}: {
  nodes: Record<string, unknown>[]
}): NonNullable<Batch15Post['content']> =>
  ({
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: null,
          format: '',
          indent: 0,
          children: [],
          $slots: {
            column: {
              type: 'paragraph',
              version: 1,
              direction: null,
              format: '',
              indent: 0,
              children: nodes,
            },
          },
        },
      ] as unknown as SerializedLexicalNode[],
    },
  }) as unknown as NonNullable<Batch15Post['content']>
const slotNodes = (value: unknown): Record<string, unknown>[] =>
  (
    value as {
      root: { children: { $slots: { column: { children: Record<string, unknown>[] } } }[] }
    }
  ).root.children[0]!.$slots.column.children

test.suite('Server regressions batch 15', { config: './config.ts' }, () => {
  test('should populate uploads in a named slot while retaining read access (#19316)', async ({
    payload,
  }) => {
    const file = (await getFileByPath('test/uploads/image.png'))!
    const media = await payload.create({
      collection: mediaSlug,
      data: { title: 'Slot image' },
      file,
      overrideAccess: true,
    })
    const post = await payload.create({
      collection: postsSlug,
      overrideAccess: true,
      data: {
        title: 'Slots',
        content: content({
          nodes: [{ type: 'upload', version: 3, relationTo: mediaSlug, value: media.id }],
        }),
      },
    })
    const allowed = await payload.findByID({
      collection: postsSlug,
      id: post.id,
      depth: 1,
      overrideAccess: true,
    })
    expect(slotNodes(allowed.content)[0]!.value).toMatchObject({
      id: media.id,
      title: 'Slot image',
    })
    const denied = await payload.findByID({
      collection: postsSlug,
      id: post.id,
      depth: 1,
      overrideAccess: false,
    })
    expect(slotNodes(denied.content)[0]!.value).toBeNull()
  })

  test('should run block subfield hooks in a named slot (#19316)', async ({ payload }) => {
    const slotChanges: unknown[] = []
    const post = await payload.create({
      context: { slotChanges },
      collection: postsSlug,
      overrideAccess: true,
      data: {
        title: 'Hooks',
        content: content({
          nodes: [
            {
              type: 'block',
              version: 2,
              fields: {
                id: '000000000000000000000001',
                blockType: blocksSlug,
                label: ' slot value ',
              },
            },
          ],
        }),
      },
    })
    expect(slotNodes(post.content)[0]!.fields).toMatchObject({ label: 'read:SLOT VALUE' })
    expect(slotChanges).toContain('SLOT VALUE')
    const stored = await payload.findByID({
      collection: postsSlug,
      id: post.id,
      overrideAccess: true,
    })
    expect(slotNodes(stored.content)[0]!.fields).toMatchObject({ label: 'read:SLOT VALUE' })
  })

  test('should reject invalid required block fields in a named slot (#19316)', async ({
    payload,
  }) => {
    await expect(
      payload.create({
        collection: postsSlug,
        overrideAccess: true,
        data: {
          title: 'Invalid',
          content: content({
            nodes: [
              {
                type: 'block',
                version: 2,
                fields: { id: '000000000000000000000001', blockType: blocksSlug, label: '' },
              },
            ],
          }),
        },
      }),
    ).rejects.toMatchObject({ name: 'ValidationError', status: 400 })
    expect((await payload.find({ collection: postsSlug, overrideAccess: true })).totalDocs).toBe(0)
  })

  test('should persist detected video MIME metadata on create and replacement (#19294)', async ({
    payload,
  }) => {
    const file = (await getFileByPath('test/uploads/christmas-mariachi-in-guadalajara.mp4'))!
    const created = await payload.create({
      collection: mediaSlug,
      overrideAccess: true,
      data: { title: 'Video' },
      file: { ...file, mimetype: 'video/webm', name: 'video.webm' },
    })
    expect(created.mimeType).toBe('video/mp4')
    const updated = await payload.update({
      collection: mediaSlug,
      id: created.id,
      overrideAccess: true,
      data: {},
      file: { ...file, mimetype: 'video/webm', name: 'replacement.webm' },
    })
    expect(updated.mimeType).toBe('video/mp4')
    const stored = await payload.findByID({
      collection: mediaSlug,
      id: created.id,
      overrideAccess: true,
    })
    expect(stored.mimeType).toBe('video/mp4')
  })
})
