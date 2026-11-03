import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { devUser } from '../credentials.js'

const previousTrailingSlash = process.env.NEXT_TRAILING_SLASH

test.suite('Trailing slash fixture', { config: './config.ts' }, () => {
  test.afterAll(() => {
    if (previousTrailingSlash === undefined) {
      delete process.env.NEXT_TRAILING_SLASH
    } else {
      process.env.NEXT_TRAILING_SLASH = previousTrailingSlash
    }
  })

  test('should initialize the login user and sample post without a signed-in user', async ({
    payload,
  }) => {
    const users = await payload.find({
      collection: 'users',
      overrideAccess: true,
      where: { email: { equals: devUser.email } },
    })
    const posts = await payload.find({
      collection: 'posts',
      overrideAccess: true,
      where: { title: { equals: 'First Post' } },
    })

    expect(users.docs).toHaveLength(1)
    expect(posts.docs).toHaveLength(1)
  })
})
