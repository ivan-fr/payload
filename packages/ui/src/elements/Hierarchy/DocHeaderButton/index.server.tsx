import type { Payload, PayloadComponent } from 'payload'

import { parsePayloadComponent } from 'payload/shared'
import React from 'react'

import { FolderIcon } from '../../../icons/Folder/index.js'
import { RenderServerComponent } from '../../RenderServerComponent/index.js'
// eslint-disable-next-line payload/no-imports-from-exports-dir -- Server component must reference exports dir for proper client boundary
import { HierarchyButtonClient } from '../../../exports/client/index.js'

export type HierarchyButtonServerProps = {
  fieldName: string
  hasMany?: boolean
  hierarchyCollectionSlug: string
  payload: Payload
}

export const HierarchyButton: React.FC<HierarchyButtonServerProps> = ({
  fieldName,
  hasMany,
  hierarchyCollectionSlug,
  payload,
}) => {
  const hierarchyCollectionConfig = payload.config.collections.find(
    (c) => c.slug === hierarchyCollectionSlug,
  )
  const hierarchyConfig =
    hierarchyCollectionConfig?.hierarchy && typeof hierarchyCollectionConfig.hierarchy === 'object'
      ? hierarchyCollectionConfig.hierarchy
      : undefined
  const IconComponent = hierarchyConfig?.admin.components.Icon
  const SmallIconComponent = hierarchyConfig?.admin.components.SmallIcon

  const renderedIcon = renderHierarchyIcon({
    component: IconComponent,
    importMap: payload.importMap,
    key: `hierarchy-button-icon-${hierarchyCollectionSlug}`,
    size: 16,
  })
  let renderedSmallIcon = renderedIcon
  if (SmallIconComponent !== IconComponent) {
    renderedSmallIcon = renderHierarchyIcon({
      component: SmallIconComponent,
      importMap: payload.importMap,
      key: `hierarchy-button-small-icon-${hierarchyCollectionSlug}`,
    })
  }

  return (
    <HierarchyButtonClient
      fieldName={fieldName}
      hasMany={hasMany}
      hierarchyCollectionSlug={hierarchyCollectionSlug}
      Icon={renderedIcon}
      SmallIcon={renderedSmallIcon}
    />
  )
}

function renderHierarchyIcon({
  component,
  importMap,
  key,
  size,
}: {
  component?: PayloadComponent
  importMap: Payload['importMap']
  key: string
  size?: 16 | 24
}): React.ReactNode {
  const reference = component ? parsePayloadComponent(component) : undefined
  if (
    !component ||
    (reference?.path === '@payloadcms/ui' && reference.exportName === 'FolderIcon')
  ) {
    const props =
      typeof component === 'object' ? { ...component.serverProps, ...component.clientProps } : {}
    return <FolderIcon size={size} {...props} />
  }
  return RenderServerComponent({ Component: component, importMap, key })
}
