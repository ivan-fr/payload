import type { PayloadRequest } from 'payload'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ admin: vi.fn(), permissions: vi.fn() }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  canAccessAdmin: fixture.admin,
}))
vi.mock('./getDocumentPermissions.js', () => ({ getDocumentPermissions: fixture.permissions }))

import { schedulePublishHandler } from './schedulePublishHandler.js'

const scheduled = { versions: { drafts: { schedulePublish: true } } }
const request = () => ({
  user: { id: 'user', collection: 'users' },
  t: () => 'Forbidden',
  i18n: { t: () => 'Success' },
  payload: {
    collections: {
      posts: { config: { slug: 'posts', ...scheduled } },
      plain: { config: { slug: 'plain' } },
    },
    config: { globals: [{ slug: 'settings', ...scheduled }] },
    db: { findOne: vi.fn() },
    delete: vi.fn(),
    jobs: { queue: vi.fn() },
    logger: { error: vi.fn() },
  },
})
const call = (req: ReturnType<typeof request>, args: Record<string, unknown>) =>
  schedulePublishHandler({ req: req as unknown as PayloadRequest, ...args } as never)

describe('scheduled mutation target authorization (#19192)', () => {
  beforeEach(() => {
    fixture.admin.mockReset().mockResolvedValue(undefined)
    fixture.permissions.mockReset().mockResolvedValue({ hasPublishPermission: false })
  })
  it('should reject scheduling when target publication access is denied', async () => {
    const req = request()
    expect(
      await call(req, { type: 'publish', doc: { relationTo: 'posts', value: 'denied' } }),
    ).toHaveProperty('error')
    expect(req.payload.jobs.queue).not.toHaveBeenCalled()
  })
  it('should authorize cancellation from the stored job target rather than caller-supplied targets', async () => {
    const req = request()
    req.payload.db.findOne.mockResolvedValue({
      id: 'job',
      taskSlug: 'schedulePublish',
      input: { doc: { relationTo: 'posts', value: 'denied' } },
    })
    fixture.permissions.mockImplementation(async ({ id }) => ({
      hasPublishPermission: id === 'allowed',
    }))
    expect(
      await call(req, { deleteID: 'job', doc: { relationTo: 'posts', value: 'allowed' } }),
    ).toHaveProperty('error')
    expect(req.payload.delete).not.toHaveBeenCalled()
    expect(req.payload.jobs.queue).not.toHaveBeenCalled()
  })
  it.each([
    {},
    { doc: { relationTo: 'plain', value: 'id' } },
    { global: 'unknown' },
    { global: 'settings', doc: { relationTo: 'posts', value: 'id' } },
  ])('should reject invalid or non-scheduled targets: %j', async (target) => {
    const req = request()
    fixture.permissions.mockResolvedValue({ hasPublishPermission: true })
    expect(await call(req, { type: 'publish', ...target })).toHaveProperty('error')
    expect(req.payload.jobs.queue).not.toHaveBeenCalled()
  })
  it('should preserve the internal queue operation and acting request after target authorization', async () => {
    const req = request()
    fixture.permissions.mockResolvedValue({ hasPublishPermission: true })
    await call(req, { type: 'publish', doc: { relationTo: 'posts', value: 0 } })
    expect(req.payload.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: true, req }),
    )
    expect(fixture.permissions).toHaveBeenCalledWith(expect.objectContaining({ id: 0, req }))
  })
  it('should allow an authorized cancellation without queueing another event', async () => {
    const req = request()
    req.payload.db.findOne.mockResolvedValue({
      id: 'job',
      taskSlug: 'schedulePublish',
      input: { global: 'settings' },
    })
    fixture.permissions.mockResolvedValue({ hasPublishPermission: true })
    expect(await call(req, { deleteID: 'job' })).toHaveProperty('message')
    expect(fixture.permissions).toHaveBeenCalledWith(
      expect.objectContaining({ globalConfig: expect.objectContaining({ slug: 'settings' }), req }),
    )
    expect(req.payload.delete).toHaveBeenCalledOnce()
    expect(req.payload.jobs.queue).not.toHaveBeenCalled()
  })
  it('should leave missing events untouched', async () => {
    const req = request()
    req.payload.db.findOne.mockResolvedValue(null)
    expect(await call(req, { deleteID: 'missing' })).toHaveProperty('error')
    expect(req.payload.delete).not.toHaveBeenCalled()
  })
})
