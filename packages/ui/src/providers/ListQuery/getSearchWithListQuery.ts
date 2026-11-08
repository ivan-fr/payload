import type { ListQuery } from 'payload'

import * as qs from 'qs-esm'

import { parseSearchParams } from '../../utilities/parseSearchParams.js'

type ListURLQuery = Pick<
  ListQuery,
  'columns' | 'groupBy' | 'limit' | 'page' | 'preset' | 'queryByGroup' | 'search' | 'sort' | 'where'
>

const listURLQueryKeys = [
  'columns',
  'groupBy',
  'limit',
  'page',
  'preset',
  'queryByGroup',
  'search',
  'sort',
  'where',
] as const satisfies ReadonlyArray<keyof ListURLQuery>

export const getSearchWithListQuery = ({
  currentSearch,
  query,
  updatedQuery,
}: {
  currentSearch: string
  query: ListQuery
  updatedQuery?: ListQuery
}): string => {
  // Server-resolved queries can contain route parameters. Core list keys are always owned here,
  // while custom keys are only owned when a refinement explicitly updates them.
  const keysToUpdate = new Set<string>([...listURLQueryKeys, ...Object.keys(updatedQuery ?? {})])
  const currentURLQuery = parseSearchParams(new URLSearchParams(currentSearch))
  const unchangedQuery = Object.fromEntries(
    Object.entries(currentURLQuery).filter(([key]) => !keysToUpdate.has(key)),
  )
  const listQuery = Object.fromEntries(
    Object.entries(query).filter(([key]) => keysToUpdate.has(key)),
  )

  return `?${qs.stringify({
    ...unchangedQuery,
    ...listQuery,
    columns: serializeQueryValue({ value: query.columns }),
    queryByGroup: serializeQueryValue({ value: query.queryByGroup }),
  })}`
}

const serializeQueryValue = ({ value }: { value: unknown }): string | undefined => {
  try {
    for (let depth = 0; typeof value === 'string' && depth < 32; depth++) {
      value = JSON.parse(value)
    }
    return typeof value === 'string' ? undefined : JSON.stringify(value)
  } catch {
    return undefined
  }
}
