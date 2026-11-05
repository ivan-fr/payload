'use client'
import type { SelectType, TypeWithID } from 'payload'

import { appendUploadSelectFields, formatAdminURL } from 'payload/shared'
import * as qs from 'qs-esm'
import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'

import { useDebounce } from '../../../hooks/useDebounce.js'
import { useConfig } from '../../../providers/Config/index.js'
import { useLocale } from '../../../providers/Locale/index.js'
import { useTranslation } from '../../../providers/Translation/index.js'
import { reducer } from './reducer.js'

// documents are first set to null when requested
// set to false when no doc is returned
// or set to the document returned
export type Documents = {
  [slug: string]: {
    [id: number | string]: false | null | TypeWithID
  }
}

type ListRelationshipContext = {
  documents: Documents
  getRelationships: (
    docs: {
      relationTo: string
      value: number | string
    }[],
  ) => void
}

const Context = createContext({} as ListRelationshipContext)

export const RelationshipProvider: React.FC<{ readonly children?: React.ReactNode }> = ({
  children,
}) => {
  const [documents, dispatchDocuments] = useReducer(reducer, {})
  const debouncedDocuments = useDebounce(documents, 100)

  const {
    config: {
      collections,
      routes: { api },
    },
  } = useConfig()

  const { i18n } = useTranslation()
  const currentLocale = useLocale()
  const locale = currentLocale?.code
  const requestScope = useMemo(
    () => ({
      api,
      collections,
      language: i18n.language,
      locale,
      pendingRequests: new Map<string, Set<string>>(),
    }),
    [api, collections, i18n.language, locale],
  )
  const previousRequests = useRef(requestScope)
  const currentScope = useRef<typeof requestScope>(null)

  useEffect(() => {
    currentScope.current = requestScope
    return () => {
      currentScope.current = null
    }
  }, [requestScope])

  const loadRelationshipDocs = useCallback(
    (reloadAll = false) => {
      const { api, collections, language, locale, pendingRequests } = requestScope

      Object.entries(debouncedDocuments).forEach(async ([slug, docs]) => {
        const idsToLoad = Object.entries(docs)
          .filter(
            ([id, value]) => (value === null || reloadAll) && !pendingRequests.get(slug)?.has(id),
          )
          .map(([id]) => id)

        if (idsToLoad.length === 0) {
          return
        }
        const collection = collections.find((c) => c.slug === slug)
        if (!collection) {
          return
        }

        const url = formatAdminURL({ apiRoute: api, path: `/${slug}` })

        const params = new URLSearchParams()
        const select: SelectType = {}

        params.append('depth', '0')
        params.append('draft', 'true')
        params.append('limit', '250')

        const fieldToSelect = collection.admin.useAsTitle ?? 'id'

        select[fieldToSelect] = true

        if (collection.upload) {
          appendUploadSelectFields({ collectionConfig: collection, select })
        }

        if (locale) {
          params.append('locale', locale)
        }

        const idsToString = idsToLoad.map((id) => String(id))
        params.append('where[id][in]', idsToString.join(','))

        const query = `?${params.toString()}&${qs.stringify({ select })}`

        let pendingIDs = pendingRequests.get(slug)
        if (!pendingIDs) {
          pendingIDs = new Set()
          pendingRequests.set(slug, pendingIDs)
        }
        idsToLoad.forEach((id) => pendingIDs.add(String(id)))

        const loadedDocs = await fetchRelationshipDocuments({ language, url: `${url}${query}` })
        idsToLoad.forEach((id) => pendingIDs.delete(id))
        if (currentScope.current === requestScope) {
          dispatchDocuments({ type: 'ADD_LOADED', docs: loadedDocs, idsToLoad, relationTo: slug })
        }
      })
    },
    [debouncedDocuments, requestScope],
  )

  useEffect(() => {
    loadRelationshipDocs(previousRequests.current !== requestScope)
    previousRequests.current = requestScope
  }, [loadRelationshipDocs, requestScope])

  const getRelationships = useCallback(
    (relationships: { relationTo: string; value: number | string }[]) => {
      dispatchDocuments({ type: 'REQUEST', docs: relationships })
    },
    [],
  )

  return <Context value={{ documents, getRelationships }}>{children}</Context>
}

export const useListRelationships = (): ListRelationshipContext => use(Context)

async function fetchRelationshipDocuments({
  language,
  url,
}: {
  language: string
  url: string
}): Promise<TypeWithID[]> {
  try {
    const result = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept-Language': language },
    })
    const json = result.ok ? await result.json() : undefined
    return Array.isArray(json?.docs) ? json.docs : []
  } catch {
    // Failed requests use the no-reference state; a later explicit REQUEST retries them.
    return []
  }
}
