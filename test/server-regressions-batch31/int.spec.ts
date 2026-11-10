import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { otherSlug, postsSlug } from './slugs.js'

test.suite('scheduled publication cleanup (#19448)', { config: './config.ts' }, () => {
  for (const isBulk of [false, true]) {
    test(`should delete only pending jobs of deleted documents (bulk: ${isBulk})`, async ({
      payload,
    }) => {
      const posts = await Promise.all(
        ['deleted', 'kept'].map((title) =>
          payload.create({
            collection: postsSlug,
            data: { title },
            overrideAccess: true,
          }),
        ),
      )
      const other = await payload.create({ collection: otherSlug, data: {}, overrideAccess: true })
      const queue = ({
        id,
        collection = postsSlug,
        asString = true,
      }: {
        asString?: boolean
        collection?: string
        id: number | string
      }) =>
        payload.jobs.queue({
          task: 'schedulePublish',
          overrideAccess: true,
          input: {
            doc: { relationTo: collection, value: asString ? String(id) : id },
            type: 'publish',
          },
          waitUntil: new Date(Date.now() + 60_000),
        })
      const deletedJob = await queue({ id: posts[0]!.id })
      const rawDeletedJob = await queue({ id: posts[0]!.id, asString: false })
      const keptJob = await queue({ id: posts[1]!.id })
      const otherJob = await queue({ id: other.id, collection: otherSlug })
      const processingJob = await queue({ id: posts[0]!.id })
      await payload.db.updateOne({
        collection: 'payload-jobs',
        id: processingJob.id,
        data: { processingUntil: new Date(Date.now() + 60_000).toISOString() },
      })
      const completedJob = await queue({ id: posts[0]!.id })
      await payload.db.updateOne({
        collection: 'payload-jobs',
        id: completedJob.id,
        data: { completedAt: new Date().toISOString() },
      })
      let secondDeletedJobID: number | string | undefined
      if (isBulk) {
        const secondDeletedPost = await payload.create({
          collection: postsSlug,
          data: { title: 'also deleted' },
          overrideAccess: true,
        })
        secondDeletedJobID = (await queue({ id: secondDeletedPost.id })).id
        await payload.delete({
          collection: postsSlug,
          where: { id: { in: [posts[0]!.id, secondDeletedPost.id] } },
          overrideAccess: true,
        })
      } else {
        await payload.delete({ collection: postsSlug, id: posts[0]!.id, overrideAccess: true })
      }
      const jobs = await payload.find({
        collection: 'payload-jobs',
        pagination: false,
        overrideAccess: true,
      })
      expect(jobs.docs.map(({ id }) => id)).not.toContain(deletedJob.id)
      expect(jobs.docs.map(({ id }) => id)).not.toContain(rawDeletedJob.id)
      expect(jobs.docs.map(({ id }) => id)).not.toContain(secondDeletedJobID)
      expect(jobs.docs.map(({ id }) => id).sort()).toEqual(
        [keptJob.id, otherJob.id, completedJob.id, processingJob.id].sort(),
      )
    })
  }
})
