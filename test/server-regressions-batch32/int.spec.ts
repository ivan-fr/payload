import { expect } from 'vitest'

import { test } from '../__helpers/int/vitest.js'
import { autoLoginEmail, otherEmail, usersSlug } from './slugs.js'

const password = 'test-password'

test.suite('batch 32 regressions', { config: './config.ts' }, () => {
  test.describe('autoLogin token refresh with sessions (#17249)', () => {
    test('should refresh the token of the autoLogin user and start a session', async ({
      payload,
      restClient,
    }) => {
      const user = await payload.create({
        collection: usersSlug,
        data: { email: autoLoginEmail, password },
        overrideAccess: true,
      })

      const response = await restClient.POST(`/${usersSlug}/refresh-token`)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.refreshedToken).toEqual(expect.any(String))
      expect(result.user.email).toBe(autoLoginEmail)

      const storedUser = await payload.db.findOne<{ sessions?: { id: string }[] }>({
        collection: usersSlug,
        where: { id: { equals: user.id } },
      })

      expect(storedUser?.sessions).toHaveLength(1)

      const refreshedAgain = await restClient.POST(`/${usersSlug}/refresh-token`, {
        auth: false,
        headers: { Authorization: `JWT ${result.refreshedToken}` },
      })

      expect(refreshedAgain.status).toBe(200)
    })

    test('should still forbid refreshing without a token when autoLogin is not applied', async ({
      payload,
      restClient,
    }) => {
      await payload.create({
        collection: usersSlug,
        data: { email: autoLoginEmail, password },
        overrideAccess: true,
      })

      const response = await restClient.POST(`/${usersSlug}/refresh-token`, { auth: false })

      expect(response.status).toBe(403)
    })

    test('should still forbid refreshing another user whose token has no session', async ({
      payload,
      restClient,
    }) => {
      const otherUser = await payload.create({
        collection: usersSlug,
        data: { email: otherEmail, password },
        overrideAccess: true,
      })
      const login = await payload.login({
        collection: usersSlug,
        data: { email: otherEmail, password },
      })

      await payload.db.updateOne({
        id: otherUser.id,
        collection: usersSlug,
        data: { sessions: [] },
      })

      const response = await restClient.POST(`/${usersSlug}/refresh-token`, {
        auth: false,
        headers: { Authorization: `JWT ${login.token}` },
      })

      expect(response.status).toBe(403)
    })
  })
})
