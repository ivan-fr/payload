import { ValidationError } from 'payload'
import { expect } from 'vitest'

import type { Batch20Post, Batch20Target } from './payload-types.js'

import { test } from '../__helpers/int/vitest.js'
import { postsSlug, targetsSlug, usersSlug } from './slugs.js'

const contentFor = ({
  target,
}: {
  target: Batch20Target['id']
}): NonNullable<Batch20Post['content']> => ({
  root: {
    type: 'root',
    version: 1,
    format: '' as const,
    indent: 0,
    direction: null,
    children: [
      {
        type: 'block',
        version: 2,
        format: '',
        fields: { id: 'block-row', blockType: 'related', target },
      },
    ],
  },
})

test.suite('Lexical hidden-collection relationships (#18121)', { config: './config.ts' }, () => {
  test('should save and resave an authorized relationship while its collection is hidden from the user', async ({
    payload,
  }) => {
    const user = await payload.create({
      collection: usersSlug,
      overrideAccess: true,
      data: { email: 'reader@example.com', password: 'password123' },
    })
    const target = await payload.create({
      collection: targetsSlug,
      overrideAccess: true,
      data: { title: 'Readable', active: true, tenant: 7 },
    })
    const content = contentFor({ target: target.id })
    const post = await payload.create({
      collection: postsSlug,
      user: { ...user, collection: usersSlug },
      overrideAccess: false,
      depth: 0,
      data: { content },
    })
    const saved = await payload.update({
      collection: postsSlug,
      id: post.id,
      user: { ...user, collection: usersSlug },
      overrideAccess: false,
      depth: 0,
      data: { content },
    })

    expect(saved.content!.root.children[0]).toMatchObject({ fields: { target: target.id } })
  })

  for (const targetData of [
    { title: 'Private', active: true, tenant: 7 },
    { title: 'Inactive', active: false, tenant: 7 },
    { title: 'Other tenant', active: true, tenant: 8 },
  ]) {
    test(`should retain read/base/original filter restrictions for ${targetData.title}`, async ({
      payload,
    }) => {
      const user = await payload.create({
        collection: usersSlug,
        overrideAccess: true,
        data: { email: 'reader@example.com', password: 'password123' },
      })
      const target = await payload.create({
        collection: targetsSlug,
        overrideAccess: true,
        data: targetData,
      })

      await expect(
        payload.create({
          collection: postsSlug,
          user: { ...user, collection: usersSlug },
          overrideAccess: false,
          data: { content: contentFor({ target: target.id }) },
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  }
})
