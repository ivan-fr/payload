import type { CollectionConfig } from 'payload'

import { breadcrumbsSlug, criteriaSlug, pagesSlug, verifiedSlug } from '../slugs.js'

const access = { create: () => true, read: () => true, update: () => true }
export const Pages: CollectionConfig = {
  slug: pagesSlug,
  access,
  admin: { useAsTitle: 'title' },
  versions: { drafts: { localizeStatus: false } },
  hierarchy: { parentFieldName: 'parent', slugField: 'slug', admin: { injectSidebarTab: false } },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'slug', type: 'text' },
  ],
}
export const BreadcrumbPages: CollectionConfig = {
  slug: breadcrumbsSlug,
  access,
  admin: { useAsTitle: 'title' },
  versions: { drafts: { localizeStatus: false } },
  fields: [{ name: 'title', type: 'text', localized: true }],
}
export const Verified: CollectionConfig = {
  slug: verifiedSlug,
  access,
  auth: { verify: true, useSessions: false },
  fields: [],
}

export const Criteria: CollectionConfig = {
  slug: criteriaSlug,
  access,
  fields: [
    {
      name: 'filter',
      type: 'json',
      jsonSchema: {
        uri: 'dummy://batch37-filter.json',
        schema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          definitions: {
            condition: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                and: { type: 'array', items: { $ref: '#/definitions/condition' } },
              },
              required: ['value'],
            },
          },
          properties: { condition: { $ref: '#/definitions/condition' } },
        },
      },
    },
  ],
}
