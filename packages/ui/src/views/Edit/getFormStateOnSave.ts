import type { ServerFunctionsContextType } from '../../providers/ServerFunctions/index.js'

type GetFormState = ServerFunctionsContextType['getFormState']

/** Ignore responses superseded by another save, including the server function's empty abort result. */
export const getFormStateOnSave = async ({
  args,
  getFormState,
}: {
  args: Parameters<GetFormState>[0]
  getFormState: GetFormState
}) => {
  const result = await getFormState(args)
  return args.signal?.aborted ? undefined : result
}
