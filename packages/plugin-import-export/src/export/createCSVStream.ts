import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

type Batch = { columns: string[]; docs: Record<string, unknown>[] }

type Args = {
  batches: AsyncIterable<Batch> | Iterable<Batch>
  getColumns: (args: { dataColumns: string[]; hasRows: boolean }) => string[]
}

/**
 * CSV needs its complete header before the first row. Spool each transformed batch
 * once, using CSV's own value casts, then replay it with the complete column list.
 * Only one batch is held in memory, and hooks and database reads are not repeated.
 */
export const createCSVStream = ({ batches, getColumns }: Args): Readable => {
  const stream: Readable = Readable.from(
    generateCSV({ batches, getColumns, isCancelled: () => stream.destroyed }),
    {
      objectMode: false,
    },
  )

  return stream
}

async function* generateCSV({
  batches,
  getColumns,
  isCancelled,
}: { isCancelled: () => boolean } & Args): AsyncGenerator<Buffer> {
  let directory: string | undefined

  try {
    directory = await mkdtemp(join(tmpdir(), 'payload-csv-'))

    let batchCount = 0
    let dataColumns: string[] = []

    for await (const batch of batches) {
      if (isCancelled()) {
        return
      }

      dataColumns = batch.columns

      if (batch.docs.length > 0) {
        await writeFile(
          join(directory, `${batchCount++}.csv`),
          stringify(batch.docs, { columns: batch.columns, header: true }),
          { mode: 0o600 },
        )
      }
    }

    if (isCancelled()) {
      return
    }

    const columns = getColumns({ dataColumns, hasRows: batchCount > 0 })

    yield Buffer.from(stringify([], { bom: true, columns, header: true }))

    for (let index = 0; index < batchCount; index++) {
      if (isCancelled()) {
        return
      }

      const csv = await readFile(join(directory, `${index}.csv`), 'utf8')
      const rows = parse(csv, { columns: true }) as Record<string, string>[]

      yield Buffer.from(stringify(rows, { columns }))
    }
  } finally {
    if (directory) {
      await rm(directory, { force: true, recursive: true })
    }
  }
}
