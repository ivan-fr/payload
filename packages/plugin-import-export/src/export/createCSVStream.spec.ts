import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { access } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { beforeEach, expect, it, vi } from 'vitest'

import { createCSVStream } from './createCSVStream.js'

const directories = vi.hoisted(() => [] as string[])

vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>()

  return {
    ...fs,
    mkdtemp: async (prefix: string) => {
      const directory = await fs.mkdtemp(prefix)

      directories.push(directory)
      return directory
    },
  }
})

beforeEach(() => {
  directories.length = 0
})

it('should include columns discovered after the first batch (#19140)', async () => {
  const stream = createCSVStream({
    batches: toBatches({
      batches: [
        { columns: ['title', 'items_0_label'], docs: [{ items_0_label: 'a', title: 'First' }] },
        {
          columns: ['title', 'items_0_label', 'items_1_label', 'items_2_label'],
          docs: [{ items_0_label: 'a', items_1_label: 'b', items_2_label: 'c', title: 'Last' }],
        },
      ],
    }),
    getColumns: ({ dataColumns }) => dataColumns,
  })
  const csv = await consume({ stream })

  expect(csv.startsWith('\uFEFFtitle,items_0_label,items_1_label,items_2_label')).toBe(true)
  expect(parse(csv, { bom: true, columns: true })).toEqual([
    { items_0_label: 'a', items_1_label: '', items_2_label: '', title: 'First' },
    { items_0_label: 'a', items_1_label: 'b', items_2_label: 'c', title: 'Last' },
  ])
})

it('should preserve CSV casting and quoting when replaying a batch', async () => {
  const columns = ['buffer', 'date', 'number', 'boolean', 'multiline', 'null', 'object']
  const docs = [
    {
      boolean: false,
      buffer: Buffer.from('binary'),
      date: new Date('2026-01-01T00:00:00Z'),
      multiline: 'a,"quoted"\r\nvalue',
      null: null,
      number: 12345678901234567890n,
      object: { nested: 'value' },
    },
  ]
  const stream = createCSVStream({
    batches: toBatches({ batches: [{ columns, docs }] }),
    getColumns: () => columns,
  })

  expect(await consume({ stream })).toBe(stringify(docs, { bom: true, columns, header: true }))
})

it('should emit schema headers for an empty export', async () => {
  const stream = createCSVStream({
    batches: toBatches({ batches: [] }),
    getColumns: ({ hasRows }) => {
      expect(hasRows).toBe(false)
      return ['id', 'title']
    },
  })

  expect(await consume({ stream })).toBe('\uFEFFid,title\n')
})

it.each(['complete', 'error', 'cancel'] as const)(
  'should remove temporary batches after %s',
  async (outcome) => {
    let producedBatches = 0
    let releaseBatch: () => void = () => {}
    const paused = new Promise<void>((resolve) => {
      releaseBatch = resolve
    })
    let notifyBatch: () => void = () => {}
    const firstBatch = new Promise<void>((resolve) => {
      notifyBatch = resolve
    })
    const batches = (async function* () {
      producedBatches++
      yield { columns: ['title'], docs: [{ title: 'First' }] }
      notifyBatch()
      if (outcome === 'error') {
        throw new Error('Failed next batch')
      }
      if (outcome === 'cancel') {
        await paused
      }
      producedBatches++
      yield { columns: ['title'], docs: [{ title: 'Second' }] }
      producedBatches++
      yield { columns: ['title'], docs: [{ title: 'Last' }] }
    })()
    const stream = createCSVStream({ batches, getColumns: ({ dataColumns }) => dataColumns })

    if (outcome === 'error') {
      await expect(consume({ stream })).rejects.toThrow('Failed next batch')
    } else if (outcome === 'cancel') {
      const reader = Readable.toWeb(stream).getReader()
      const reading = reader.read()

      await firstBatch
      const closed = new Promise<void>((resolve) => stream.once('close', () => resolve()))
      const cancelled = reader.cancel()

      releaseBatch()
      await Promise.all([closed, cancelled, reading])
    } else {
      await consume({ stream })
    }

    expect(producedBatches).toBe(outcome === 'cancel' ? 2 : outcome === 'error' ? 1 : 3)
    expect(directories).toHaveLength(1)
    await expect(access(directories[0]!)).rejects.toMatchObject({ code: 'ENOENT' })
  },
)

async function* toBatches({
  batches,
}: {
  batches: { columns: string[]; docs: Record<string, unknown>[] }[]
}) {
  yield* batches
}

async function consume({ stream }: { stream: ReturnType<typeof createCSVStream> }) {
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}
