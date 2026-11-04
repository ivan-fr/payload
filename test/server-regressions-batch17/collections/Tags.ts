import type { CollectionConfig } from 'payload'

import { mongooseList } from '../../__helpers/shared/isMongoose.js'
import { tagsSlug } from '../slugs.js'

export const Tags: CollectionConfig = {
  slug: tagsSlug,
  admin: { useAsTitle: 'name' },
  hierarchy: {
    parentFieldName: 'parent', // SQL polymorphic has-many joins are a separate adapter limitation.
    joinField: mongooseList.includes(process.env.PAYLOAD_DATABASE!)
      ? { name: 'children' }
      : undefined,
    admin: { injectSidebarTab: false },
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        { label: 'Details', fields: [{ name: 'description', type: 'textarea' }] },
        { label: 'General', fields: [{ name: 'name', type: 'text', required: true }] },
      ],
    },
  ],
}
