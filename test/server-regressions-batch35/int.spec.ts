import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { peopleSlug, postsSlug } from './slugs.js'

test.suite('batch 35 server regressions', { config: './config.ts' }, () => {
  test('should resolve a virtual field from a related afterRead calculation', async ({
    payload,
  }) => {
    const person = await payload.create({
      collection: peopleSlug,
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        profile: { nickname: 'Ada' },
        layout: [{ blockType: 'card', label: 'Ada' }],
      },
      overrideAccess: true,
    })
    const post = await payload.create({
      collection: postsSlug,
      data: { category: 'fixed', owner: person.id },
      overrideAccess: true,
    })
    const result = await payload.findByID({
      collection: postsSlug,
      id: post.id,
      depth: 0,
      overrideAccess: true,
    })

    expect(result.ownerName).toBe('Ada Lovelace')
  })

  test('should restore required immutable fields without allowing a field access bypass', async ({
    payload,
  }) => {
    const post = await payload.create({
      collection: postsSlug,
      data: { title: 'Original', category: 'original' },
      overrideAccess: true,
    })
    const versions = await payload.findVersions({
      collection: postsSlug,
      where: { parent: { equals: post.id } },
      overrideAccess: true,
    })
    await payload.update({
      collection: postsSlug,
      id: post.id,
      data: { title: 'Changed', category: 'privileged change' },
      overrideAccess: true,
    })
    const restored = await payload.restoreVersion({
      collection: postsSlug,
      id: versions.docs[0].id,
      overrideAccess: false,
    })

    expect(restored.title).toBe('Original')
    expect(restored.category).toBe('privileged change')
    const updated = await payload.update({
      collection: postsSlug,
      id: post.id,
      data: { category: 'unprivileged change' },
      overrideAccess: false,
    })

    expect(updated.category).toBe('privileged change')
  })

  test('should clear hasMany relationships absent from the restored snapshot', async ({
    payload,
  }) => {
    const person = await payload.create({ collection: peopleSlug, data: {}, overrideAccess: true })
    const post = await payload.create({
      collection: postsSlug,
      data: { category: 'fixed' },
      overrideAccess: true,
    })
    const versions = await payload.findVersions({
      collection: postsSlug,
      where: { parent: { equals: post.id } },
      overrideAccess: true,
    })
    await payload.update({
      collection: postsSlug,
      id: post.id,
      data: { reviewers: [person.id] },
      overrideAccess: true,
    })
    const restored = await payload.restoreVersion({
      collection: postsSlug,
      id: versions.docs[0].id,
      overrideAccess: true,
      depth: 0,
    })

    expect(restored.reviewers ?? []).toEqual([])
  })

  test('should save JSON values with a type-generation transform without fetching a schema', async ({
    payload,
  }) => {
    const post = await payload.create({
      collection: postsSlug,
      data: { category: 'fixed', tags: ['one', 'two'] },
      overrideAccess: true,
    })

    expect(post.tags).toEqual(['one', 'two'])
  })
  test('should backfill the documented latest versions without publishing existing drafts', async ({
    payload,
  }) => {
    const timestamp = new Date().toISOString()
    const legacy = await payload.db.create({
      collection: postsSlug,
      data: {
        title: 'Legacy',
        category: 'fixed',
        _status: 'published',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    })
    const existing = await payload.create({
      collection: postsSlug,
      data: { title: 'Published', category: 'fixed', _status: 'published' },
      overrideAccess: true,
    })
    await payload.update({
      collection: postsSlug,
      id: existing.id,
      data: { title: 'Pending' },
      draft: true,
      overrideAccess: true,
    })
    const before = await payload.find({ collection: postsSlug, draft: true, overrideAccess: true })

    expect(before.docs.map(({ id }) => id)).not.toContain(legacy.id)
    const docs = await readFile(new URL('../../docs/versions/drafts.mdx', import.meta.url), 'utf8')
    const source = docs.match(
      /```ts\n(import type \{ CollectionSlug, Payload \} from 'payload'[\s\S]*?)```/,
    )[1]
    const module = { exports: {} as { backfillDraftVersions: (args: object) => Promise<void> } }
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText
    runInNewContext(compiled, { exports: module.exports })
    const backfill = () =>
      module.exports.backfillDraftVersions({ collection: postsSlug, payload, status: 'published' })
    await backfill()
    const after = await payload.find({ collection: postsSlug, draft: true, overrideAccess: true })

    expect(after.docs.map(({ id }) => id)).toContain(legacy.id)
    expect(after.docs.find(({ id }) => id === existing.id).title).toBe('Pending')
    const live = await payload.findByID({
      collection: postsSlug,
      id: existing.id,
      draft: false,
      overrideAccess: true,
    })

    expect(live.title).toBe('Published')
    const versionsBefore = await payload.countVersions({
      collection: postsSlug,
      overrideAccess: true,
    })
    await backfill()
    const versionsAfter = await payload.countVersions({
      collection: postsSlug,
      overrideAccess: true,
    })

    expect(versionsAfter.totalDocs).toBe(versionsBefore.totalDocs)
  })

  test('should populate calculated virtual values for hasMany relationships without unrelated virtual reads', async ({
    payload,
  }) => {
    const first = await payload.create({
      collection: peopleSlug,
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        profile: { nickname: 'Ada' },
        layout: [{ blockType: 'card', label: 'Ada' }],
      },
      overrideAccess: true,
    })
    const second = await payload.create({
      collection: peopleSlug,
      data: { firstName: 'Grace', lastName: 'Hopper' },
      overrideAccess: true,
    })
    const post = await payload.create({
      collection: postsSlug,
      data: { category: 'fixed', owner: first.id, reviewers: [second.id, first.id] },
      overrideAccess: true,
    })
    const result = await payload.findByID({
      collection: postsSlug,
      id: post.id,
      context: { disallowOtherVirtual: true },
      depth: 0,
      overrideAccess: true,
    })

    expect(result.ownerName).toBe('Ada Lovelace')
    expect(result.reviewerNames).toEqual(['Grace Hopper', 'Ada Lovelace'])
  })

  test('should validate JSON values while independently transforming their generated schema', async ({
    payload,
  }) => {
    const created = await payload.create({
      collection: postsSlug,
      data: { category: 'fixed', validatedTags: ['tag'] },
      overrideAccess: true,
    })

    expect(created.validatedTags).toEqual(['tag'])
    await expect(
      payload.update({
        collection: postsSlug,
        id: created.id,
        data: { validatedTags: [1] },
        overrideAccess: true,
      }),
    ).rejects.toThrow('invalid')
  })
  test('should respect related collection access when loading virtual hook dependencies', async ({
    payload,
  }) => {
    const person = await payload.create({
      collection: peopleSlug,
      data: { firstName: 'Private', lastName: 'Person' },
      overrideAccess: true,
    })
    const post = await payload.create({
      collection: postsSlug,
      data: { category: 'fixed', owner: person.id, reviewers: [person.id] },
      overrideAccess: true,
    })
    const result = await payload.findByID({
      collection: postsSlug,
      id: post.id,
      context: { denyPeople: true },
      depth: 0,
      overrideAccess: false,
    })

    expect(result.ownerName).toBeUndefined()
    expect(result.reviewerNames ?? []).toEqual([])
  })
})
