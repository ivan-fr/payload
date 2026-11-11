import type { Payload } from 'payload'

import { createPayloadRequest } from 'payload'
import { expect } from 'vitest'

import { getIsLocked } from '../../packages/ui/src/utilities/getIsLocked.js'
import { test } from '../__helpers/int/vitest.js'
import {
  articlesSlug,
  authorsSlug,
  documentsSlug,
  lockedDocumentsSlug,
  organizationsSlug,
  postsSlug,
  usersSlug,
} from './slugs.js'

const password = 'test-password'

const createUser = ({ email, payload }: { email: string; payload: Payload }) =>
  payload.create({ collection: usersSlug, data: { email, password }, overrideAccess: true })

const createPost = ({ payload }: { payload: Payload }) =>
  payload.create({
    collection: postsSlug,
    data: { category: 'news', internalNote: 'first note', title: 'First title' },
    overrideAccess: true,
  })

const lockPost = ({
  payload,
  postID,
  userID,
}: {
  payload: Payload
  postID: number | string
  userID: number | string
}) =>
  payload.create({
    collection: lockedDocumentsSlug,
    data: {
      document: { relationTo: postsSlug, value: postID },
      user: { relationTo: usersSlug, value: userID },
    },
    overrideAccess: true,
  })

const countLocks = async ({ payload }: { payload: Payload }) =>
  (await payload.count({ collection: lockedDocumentsSlug, overrideAccess: true })).totalDocs

test.suite('batch 33 regressions', { config: './config.ts' }, () => {
  test.describe('document locks of deleted users (#18200)', () => {
    test('should delete the locks owned by a user that is deleted by ID', async ({ payload }) => {
      const editor = await createUser({ email: 'editor@payloadcms.com', payload })
      const otherEditor = await createUser({ email: 'other@payloadcms.com', payload })
      const post = await createPost({ payload })
      const otherPost = await createPost({ payload })

      await lockPost({ payload, postID: post.id, userID: editor.id })
      await lockPost({ payload, postID: otherPost.id, userID: otherEditor.id })

      await payload.delete({ id: editor.id, collection: usersSlug, overrideAccess: true })

      const remainingLocks = await payload.find({
        collection: lockedDocumentsSlug,
        depth: 0,
        overrideAccess: true,
      })

      expect(remainingLocks.docs).toHaveLength(1)
      expect(remainingLocks.docs[0]?.user.value).toBe(otherEditor.id)
    })

    test('should delete the locks owned by users that are deleted in bulk', async ({ payload }) => {
      const editor = await createUser({ email: 'editor@payloadcms.com', payload })
      const secondEditor = await createUser({ email: 'second@payloadcms.com', payload })
      const post = await createPost({ payload })
      const otherPost = await createPost({ payload })

      await lockPost({ payload, postID: post.id, userID: editor.id })
      await lockPost({ payload, postID: otherPost.id, userID: secondEditor.id })

      await payload.delete({
        collection: usersSlug,
        overrideAccess: true,
        where: { id: { in: [editor.id, secondEditor.id] } },
      })

      expect(await countLocks({ payload })).toBe(0)
    })

    test('should not lock anyone out of a document whose lock has no owner', async ({
      payload,
    }) => {
      const admin = await createUser({ email: 'admin@payloadcms.com', payload })
      const post = await createPost({ payload })
      const postsConfig = payload.collections[postsSlug]!.config
      const req = await createPayloadRequest({
        payload,
        user: { ...admin, collection: usersSlug },
      })

      // Databases written by earlier versions already contain locks whose owner was deleted
      await payload.db.create({
        collection: lockedDocumentsSlug,
        data: { document: { relationTo: postsSlug, value: post.id } },
      })

      expect(await countLocks({ payload })).toBe(1)
      await expect(
        getIsLocked({ id: post.id, collectionConfig: postsConfig, isEditing: true, req }),
      ).resolves.toEqual({ isLocked: false })

      const updatedPost = await payload.update({
        id: post.id,
        collection: postsSlug,
        data: { title: 'Updated despite ownerless lock' },
        overrideLock: false,
        req,
      })

      expect(updatedPost.title).toBe('Updated despite ownerless lock')
    })

    test('should still lock other users out while the lock owner exists', async ({ payload }) => {
      const admin = await createUser({ email: 'admin@payloadcms.com', payload })
      const editor = await createUser({ email: 'editor@payloadcms.com', payload })
      const post = await createPost({ payload })
      const postsConfig = payload.collections[postsSlug]!.config
      const req = await createPayloadRequest({
        payload,
        user: { ...admin, collection: usersSlug },
      })

      await lockPost({ payload, postID: post.id, userID: editor.id })

      const lockStatus = await getIsLocked({
        id: post.id,
        collectionConfig: postsConfig,
        isEditing: true,
        req,
      })

      expect(lockStatus.isLocked).toBe(true)
      await expect(
        payload.update({
          id: post.id,
          collection: postsSlug,
          data: { title: 'Blocked' },
          overrideLock: false,
          req,
        }),
      ).rejects.toMatchObject({ status: 423 })
    })
  })

  test.describe('restoring versions with fields the user may not update (#16718)', () => {
    test('should restore a version and keep the current value of fields without update access', async ({
      payload,
    }) => {
      const user = await createUser({ email: 'editor@payloadcms.com', payload })
      const post = await createPost({ payload })

      await payload.update({
        id: post.id,
        collection: postsSlug,
        data: { category: 'sports', internalNote: 'second note', title: 'Second title' },
        overrideAccess: true,
      })

      const versions = await payload.findVersions({
        collection: postsSlug,
        overrideAccess: true,
        sort: 'createdAt',
        where: { parent: { equals: post.id } },
      })
      const firstVersion = versions.docs.find(({ version }) => version.title === 'First title')

      const restoredPost = await payload.restoreVersion({
        id: firstVersion!.id,
        collection: postsSlug,
        overrideAccess: false,
        user: { ...user, collection: usersSlug },
      })

      expect(restoredPost.title).toBe('First title')
      expect(restoredPost.category).toBe('sports')
      expect(restoredPost.internalNote).toBe('second note')
    })

    test('should restore every field of the version when access is overridden', async ({
      payload,
    }) => {
      const post = await createPost({ payload })

      await payload.update({
        id: post.id,
        collection: postsSlug,
        data: { category: 'sports', internalNote: null, title: 'Second title' },
        overrideAccess: true,
      })

      const versions = await payload.findVersions({
        collection: postsSlug,
        overrideAccess: true,
        where: { parent: { equals: post.id } },
      })
      const firstVersion = versions.docs.find(({ version }) => version.title === 'First title')

      const restoredPost = await payload.restoreVersion({
        id: firstVersion!.id,
        collection: postsSlug,
        overrideAccess: true,
      })

      expect(restoredPost).toMatchObject({
        category: 'news',
        internalNote: 'first note',
        title: 'First title',
      })
    })
  })

  test.describe('populating documents that select virtual fields (#13089)', () => {
    const createArticle = async ({ payload }: { payload: Payload }) => {
      const organization = await payload.create({
        collection: organizationsSlug,
        data: { name: 'Payload' },
        overrideAccess: true,
      })
      const author = await payload.create({
        collection: authorsSlug,
        data: { name: 'Ada', bio: 'Not part of defaultPopulate', organization: organization.id },
        overrideAccess: true,
      })
      const article = await payload.create({
        collection: articlesSlug,
        data: { author: author.id, title: 'Virtual fields' },
        depth: 0,
        overrideAccess: true,
      })

      return { article, author }
    }

    test('should populate a relationship whose defaultPopulate selects a virtual field', async ({
      payload,
    }) => {
      const { article, author } = await createArticle({ payload })

      const populatedArticle = await payload.findByID({
        id: article.id,
        collection: articlesSlug,
        depth: 1,
        overrideAccess: true,
      })

      expect(populatedArticle.author).toMatchObject({
        id: author.id,
        name: 'Ada',
        organizationName: 'Payload',
      })
      expect(populatedArticle.author).not.toHaveProperty('bio')
    })

    test('should populate a relationship whose populate argument selects a virtual field', async ({
      payload,
    }) => {
      const { article, author } = await createArticle({ payload })
      const populate = { [authorsSlug]: { organizationName: true } }

      const populatedArticle = await payload.findByID({
        id: article.id,
        collection: articlesSlug,
        depth: 1,
        overrideAccess: true,
        populate,
      })

      expect(populatedArticle.author).toMatchObject({ id: author.id, organizationName: 'Payload' })
      expect(populate).toEqual({ [authorsSlug]: { organizationName: true } })
    })

    test('should leave the collection defaultPopulate untouched after reads', async ({
      payload,
    }) => {
      const { article } = await createArticle({ payload })

      await payload.findByID({
        id: article.id,
        collection: articlesSlug,
        depth: 1,
        overrideAccess: true,
      })

      expect(payload.collections[authorsSlug]!.config.defaultPopulate).toEqual({
        name: true,
        organizationName: true,
      })
    })
  })

  test.describe('values of removed array and block items (#18160, #17724)', () => {
    const createDocument = async ({ payload }: { payload: Payload }) => {
      const [first, second] = await Promise.all(
        ['First', 'Second'].map((name) =>
          payload.create({ collection: organizationsSlug, data: { name }, overrideAccess: true }),
        ),
      )
      const items = [
        { label: 'kept', related: [first!.id], scores: [1], tags: ['kept-tag'] },
        {
          label: 'removed',
          owner: { relationTo: organizationsSlug, value: second!.id },
          related: [second!.id],
          scores: [2, 3],
          tags: ['removed-tag'],
        },
      ]
      const document = await payload.create({
        collection: documentsSlug,
        data: {
          featured: [second!.id],
          layout: items.map((item) => ({ ...item, blockType: 'content' as const })),
          rows: items,
          rows_extra: [{ tags: ['extra-tag'] }],
          title: 'Nested values',
        },
        depth: 0,
        overrideAccess: true,
      })

      return { document, first: first!, second: second! }
    }

    test('should not hand the values of a removed item to an item appended later', async ({
      payload,
    }) => {
      const { document, first, second } = await createDocument({ payload })

      const shortened = await payload.update({
        id: document.id,
        collection: documentsSlug,
        data: { layout: [document.layout![0]!], rows: [document.rows![0]!] },
        depth: 0,
        overrideAccess: true,
      })

      const appended = await payload.update({
        id: document.id,
        collection: documentsSlug,
        data: {
          layout: [shortened.layout![0]!, { blockType: 'content', label: 'appended' }],
          rows: [shortened.rows![0]!, { label: 'appended' }],
        },
        depth: 0,
        overrideAccess: true,
      })

      for (const items of [appended.rows!, appended.layout!]) {
        expect(items[0]).toMatchObject({
          label: 'kept',
          related: [first.id],
          scores: [1],
          tags: ['kept-tag'],
        })
        expect(items[1]!.label).toBe('appended')
        expect(items[1]!.related ?? []).toEqual([])
        expect(items[1]!.owner ?? null).toBeNull()
        expect(items[1]!.tags ?? []).toEqual([])
        expect(items[1]!.scores ?? []).toEqual([])
      }

      const stillReferenced = await payload.find({
        collection: documentsSlug,
        depth: 0,
        overrideAccess: true,
        where: {
          or: [
            { 'rows.related': { equals: second.id } },
            { 'layout.related': { equals: second.id } },
            { 'rows.tags': { equals: 'removed-tag' } },
            { 'rows.scores': { equals: 3 } },
          ],
        },
      })

      expect(stillReferenced.totalDocs).toBe(0)
    })

    test('should keep nested values of fields that an update does not touch', async ({
      payload,
    }) => {
      const { document, second } = await createDocument({ payload })

      const updated = await payload.update({
        id: document.id,
        collection: documentsSlug,
        data: { rows: [document.rows![0]!] },
        depth: 0,
        overrideAccess: true,
      })

      expect(updated.rows).toHaveLength(1)
      expect(updated.featured).toEqual([second.id])
      expect(updated.rows_extra![0]!.tags).toEqual(['extra-tag'])
      expect(updated.layout).toHaveLength(2)
      expect(updated.layout![1]).toMatchObject({
        owner: { relationTo: organizationsSlug, value: second.id },
        related: [second.id],
        scores: [2, 3],
        tags: ['removed-tag'],
      })
    })
  })

  test.describe('concurrent logins to one account (#18132)', () => {
    const email = 'concurrent@payloadcms.com'
    const loginCount = 8

    const readStoredSessions = async ({ payload, userID }: { payload: Payload; userID: number }) =>
      (
        await payload.db.findOne<{ sessions?: { expiresAt: Date | string; id: string }[] }>({
          collection: usersSlug,
          where: { id: { equals: userID } },
        })
      )?.sessions ?? []

    test('should keep the session of every concurrent login', async ({ payload, restClient }) => {
      const user = await createUser({ email, payload })

      const logins = await Promise.all(
        Array.from({ length: loginCount }, () =>
          payload.login({ collection: usersSlug, data: { email, password } }),
        ),
      )

      const storedSessions = await readStoredSessions({ payload, userID: user.id })

      expect(new Set(storedSessions.map(({ id }) => id)).size).toBe(loginCount)

      const authenticatedUsers = await Promise.all(
        logins.map(async ({ token }) => {
          const response = await restClient.GET(`/${usersSlug}/me`, {
            auth: false,
            headers: { Authorization: `JWT ${token}` },
          })

          return (await response.json()).user?.email
        }),
      )

      expect(authenticatedUsers).toEqual(Array.from({ length: loginCount }, () => email))
    })

    test('should remove expired sessions on login and keep the active ones', async ({
      payload,
    }) => {
      const user = await createUser({ email, payload })
      const firstLogin = await payload.login({ collection: usersSlug, data: { email, password } })
      const [activeSession] = await readStoredSessions({ payload, userID: user.id })

      await payload.db.updateOne({
        id: user.id,
        collection: usersSlug,
        data: {
          sessions: [
            activeSession,
            { id: 'expired-session', createdAt: new Date(0), expiresAt: new Date(1000) },
          ],
        },
      })

      await payload.login({ collection: usersSlug, data: { email, password } })

      const storedSessions = await readStoredSessions({ payload, userID: user.id })

      expect(firstLogin.token).toEqual(expect.any(String))
      expect(storedSessions).toHaveLength(2)
      expect(storedSessions.map(({ id }) => id)).toContain(activeSession!.id)
      expect(storedSessions.map(({ id }) => id)).not.toContain('expired-session')
    })

    test('should end only its own session on logout', async ({ payload, restClient }) => {
      const user = await createUser({ email, payload })
      const [firstLogin, secondLogin] = await Promise.all([
        payload.login({ collection: usersSlug, data: { email, password } }),
        payload.login({ collection: usersSlug, data: { email, password } }),
      ])

      const logout = await restClient.POST(`/${usersSlug}/logout`, {
        auth: false,
        headers: { Authorization: `JWT ${firstLogin.token}` },
      })
      const stillLoggedIn = await restClient.GET(`/${usersSlug}/me`, {
        auth: false,
        headers: { Authorization: `JWT ${secondLogin.token}` },
      })

      expect(logout.status).toBe(200)
      expect(await readStoredSessions({ payload, userID: user.id })).toHaveLength(1)
      expect((await stillLoggedIn.json()).user?.email).toBe(email)
    })
  })
})
