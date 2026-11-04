import type { Payload } from 'payload'

import nodemailer from 'nodemailer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nodemailerAdapter } from './index.js'

const cache = globalThis as typeof globalThis & { __payloadEtherealAccount?: unknown }
const account = { user: 'mock-user', pass: 'mock-pass', web: 'https://ethereal.email' }
const args = {
  defaultFromAddress: 'sender@example.com',
  defaultFromName: 'Sender',
  skipVerify: true,
}

beforeEach(() => {
  delete cache.__payloadEtherealAccount
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  delete cache.__payloadEtherealAccount
  vi.restoreAllMocks()
})

describe('Ethereal account reuse (#9226)', () => {
  it('should share in-flight creation and logs across initializations and module reloads', async () => {
    let resolveAccount!: (value: unknown) => void
    const pending = new Promise((resolve) => {
      resolveAccount = resolve
    })
    const create = vi
      .spyOn(nodemailer, 'createTestAccount')
      .mockImplementation(() => pending as never)
    const transport = nodemailer.createTransport({ jsonTransport: true })
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue(transport)
    const first = nodemailerAdapter()
    const second = nodemailerAdapter(args)
    resolveAccount(account)
    await Promise.all([first, second])
    vi.resetModules()
    const reloaded = await import('./index.js')
    await reloaded.nodemailerAdapter()
    expect(create).toHaveBeenCalledTimes(1)
    expect(console.info).toHaveBeenCalledTimes(4)
  })

  it('should retry account creation after a failure', async () => {
    const create = vi
      .spyOn(nodemailer, 'createTestAccount')
      .mockRejectedValueOnce(new Error('offline') as never)
      .mockResolvedValue(account as never)
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue(
      nodemailer.createTransport({ jsonTransport: true }),
    )
    await expect(nodemailerAdapter()).rejects.toThrow('offline')
    await expect(nodemailerAdapter()).resolves.toBeTypeOf('function')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('should preserve each adapter sender and use the cached account for its transport', async () => {
    vi.spyOn(nodemailer, 'createTestAccount').mockResolvedValue(account as never)
    const originalCreate = nodemailer.createTransport.bind(nodemailer)
    const createTransport = vi
      .spyOn(nodemailer, 'createTransport')
      .mockImplementation(() => originalCreate({ jsonTransport: true }))
    const first = await nodemailerAdapter(args)
    const second = await nodemailerAdapter({
      ...args,
      defaultFromName: 'Other',
      defaultFromAddress: 'other@example.com',
    })
    const send = async (adapter: typeof first) =>
      JSON.parse(
        (
          (await adapter({ payload: {} as Payload }).sendEmail({ to: 'test@example.com' })) as {
            message: string
          }
        ).message,
      )
    expect((await send(first)).from).toMatchObject({
      address: 'sender@example.com',
      name: 'Sender',
    })
    expect((await send(second)).from).toMatchObject({ address: 'other@example.com', name: 'Other' })
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: account.user, pass: account.pass } }),
    )
  })

  it('should avoid Ethereal for explicit transports and transport options', async () => {
    const create = vi.spyOn(nodemailer, 'createTestAccount')
    await nodemailerAdapter({
      ...args,
      transport: nodemailer.createTransport({ jsonTransport: true }),
    })
    await nodemailerAdapter({ ...args, transportOptions: { host: 'localhost', port: 1025 } })
    expect(create).not.toHaveBeenCalled()
  })
})
