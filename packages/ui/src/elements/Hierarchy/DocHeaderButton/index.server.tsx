import type { Payload } from 'payload'

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

  // Render the custom icon if provided, otherwise use FolderIcon directly
  // Important: Must render the icon here on server to avoid hydration mismatch
  // For default FolderIcon path, render directly to avoid import map requirement
  const iconReference = IconComponent ? parsePayloadComponent(IconComponent) : undefined
  const isDefaultFolderIcon =
    !IconComponent ||
    (iconReference?.path === '@payloadcms/ui' && iconReference.exportName === 'FolderIcon')
  const renderedIcon = isDefaultFolderIcon ? (
    <FolderIcon
      size={16}
      {...(typeof IconComponent === 'object' ? IconComponent?.serverProps : {})}
      {...(typeof IconComponent === 'object' ? IconComponent?.clientProps : {})}
    />
  ) : (
    RenderServerComponent({
      Component: IconComponent,
      importMap: payload.importMap,
      key: `hierarchy-button-icon-${hierarchyCollectionSlug}`,
    })
  )

  // Render the small icon for compact display (pill button)
  // Reuse the full icon if SmallIcon is the same component
  const smallIconReference = SmallIconComponent
    ? parsePayloadComponent(SmallIconComponent)
    : undefined
  const isDefaultSmallIcon =
    !SmallIconComponent ||
    (smallIconReference?.path === '@payloadcms/ui' &&
      smallIconReference.exportName === 'FolderIcon')
  const renderedSmallIcon =
    SmallIconComponent === IconComponent ? (
      renderedIcon
    ) : isDefaultSmallIcon ? (
      <FolderIcon
        {...(typeof SmallIconComponent === 'object' ? SmallIconComponent?.serverProps : {})}
        {...(typeof SmallIconComponent === 'object' ? SmallIconComponent?.clientProps : {})}
      />
    ) : (
      RenderServerComponent({
        Component: SmallIconComponent,
        importMap: payload.importMap,
        key: `hierarchy-button-small-icon-${hierarchyCollectionSlug}`,
      })
    )

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
