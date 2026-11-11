import type { I18nClient } from '@payloadcms/translations'
import type { AdminViewAdapter, AdminViewKey, MetaConfig, SanitizedConfig } from 'payload'

import { generateCollectionTrashMetadata } from '../CollectionTrash/generateCollectionTrashMetadata.js'
import { getMetaBySegment } from '../Document/getMetaBySegment.js'
import { generateListViewMetadata } from '../List/generateListViewMetadata.js'
import { generateCustomViewMetadata } from './generateCustomViewMetadata.js'
import { getCustomViewByRoute } from './getCustomViewByRoute.js'

export type GeneratePageMetadataArgs = {
  adminViews: AdminViewAdapter<unknown, MetaConfig>
  config: SanitizedConfig
  i18n: I18nClient
  params: { [key: string]: string | string[] | undefined; segments?: string | string[] }
}

const oneSegmentMetaKeys: Record<string, AdminViewKey> = {
  logout: 'unauthorized',
  'logout-inactivity': 'unauthorized',
}

/**
 * Resolves an admin page's `MetaConfig` from route segments. Shared by all
 * framework adapters — segment-routing logic lives here so adapters do not
 * duplicate it. Returns the framework-agnostic `MetaConfig`; adapters cast to
 * their framework metadata type at the boundary.
 */
export const generatePageMetadata = async ({
  adminViews,
  config,
  i18n,
  params,
}: GeneratePageMetadataArgs): Promise<MetaConfig> => {
  const rawSegments = params.segments
  const segments = Array.isArray(rawSegments) ? rawSegments : []
  const currentRoute = `/${segments.join('/')}`
  const [segmentOne, segmentTwo] = segments

  const configuredView = getConfiguredAuthMetadataView({ config, currentRoute })

  if (configuredView) {
    return adminViews[configuredView].generateMetadata({ config, i18n })
  }

  let meta: MetaConfig | undefined

  if (segments.length === 0) {
    meta = await adminViews.dashboard.generateMetadata({ config, i18n })
  } else if (segments.length === 1) {
    if (segmentOne === 'account') {
      meta = await adminViews.account.generateMetadata({ config, i18n })
    } else if (oneSegmentMetaKeys[segmentOne]) {
      meta = await adminViews[oneSegmentMetaKeys[segmentOne]].generateMetadata({ config, i18n })
    }
  } else if (segments.length > 2 && segmentTwo === 'verify') {
    meta = await adminViews.verify.generateMetadata({ config, i18n })
  } else {
    meta = await getEntityMetadata({
      adminViews,
      config,
      i18n,
      params,
      segments,
    })
  }

  if (!meta) {
    const { viewConfig, viewKey } = getCustomViewByRoute({ config, currentRoute })

    if (viewKey) {
      meta = await generateCustomViewMetadata({ config, i18n, viewConfig })
    } else {
      meta = await adminViews.notFound.generateMetadata({ config, i18n })
    }
  }

  return meta
}

function getConfiguredAuthMetadataView({
  config,
  currentRoute,
}: {
  config: SanitizedConfig
  currentRoute: string
}): AdminViewKey | undefined {
  const { routes } = config.admin
  const keys = ['createFirstUser', 'forgot', 'login', 'unauthorized'] as const

  for (const key of keys) {
    if (routes[key] && currentRoute === routes[key]) {
      return key
    }
  }

  if (routes.reset && currentRoute.startsWith(`${routes.reset}/`)) {
    return 'reset'
  }
  return undefined
}

function getEntityMetadata({
  adminViews,
  config,
  i18n,
  params,
  segments,
}: {
  segments: string[]
} & GeneratePageMetadataArgs) {
  const [segmentOne, segmentTwo] = segments
  const isCollection = segmentOne === 'collections'
  const isGlobal = segmentOne === 'globals'

  const collectionConfig =
    isCollection && segments.length > 1
      ? config?.collections?.find((c) => c.slug === segmentTwo)
      : undefined

  const globalConfig =
    isGlobal && segments.length > 1
      ? config?.globals?.find((g) => g.slug === segmentTwo)
      : undefined

  if (collectionConfig) {
    if (segments.length === 2) {
      return generateListViewMetadata({ collectionConfig, config, i18n })
    }
    if (segments.length === 3 && segments[2] === 'trash') {
      return generateCollectionTrashMetadata({ collectionConfig, config, i18n, params })
    }
    return getMetaBySegment({ adminViews, collectionConfig, config, i18n, params })
  }
  if (globalConfig) {
    return getMetaBySegment({ adminViews, config, globalConfig, i18n, params })
  }
}
