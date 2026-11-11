import { fileTypeFromTokenizer } from 'file-type'
import { fromFile, NotRegularFileError } from 'strtok3'

/** Statically import the Node tokenizer so deployment tracers include its file implementation. */
export const detectFileTypeFromFile = async ({ path }: { path: string }) => {
  let tokenizer: Awaited<ReturnType<typeof fromFile>>
  try {
    tokenizer = await fromFile(path, { regularFileOnly: true })
  } catch (error) {
    if (error instanceof NotRegularFileError) {
      return undefined
    }
    throw error
  }
  try {
    return await fileTypeFromTokenizer(tokenizer)
  } finally {
    await tokenizer.close()
  }
}
