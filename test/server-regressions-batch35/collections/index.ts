import type { CollectionConfig, Field } from 'payload'

import { peopleSlug, postsSlug } from '../slugs.js'

const unrelatedVirtual: Field = {
  name: 'nestedComputed',
  type: 'text',
  virtual: true,
  hooks: {
    afterRead: [
      ({ req }) => {
        if (req.context.disallowOtherVirtual) {
          throw new Error('Unrelated nested virtual field was read')
        }
        return 'computed'
      },
    ],
  },
}

export const People: CollectionConfig = {
  slug: peopleSlug,
  access: { read: ({ req }) => !req.context.denyPeople },
  fields: [
    {
      name: 'profile',
      type: 'group',
      fields: [{ name: 'nickname', type: 'text' }, unrelatedVirtual],
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [{ slug: 'card', fields: [{ name: 'label', type: 'text' }, unrelatedVirtual] }],
    },
    { name: 'firstName', type: 'text' },
    { name: 'lastName', type: 'text' },
    {
      name: 'otherVirtual',
      type: 'text',
      virtual: true,
      hooks: {
        afterRead: [
          ({ req }) => {
            if (req.context.disallowOtherVirtual) {
              throw new Error('Unrelated virtual field was read')
            }
            return 'other'
          },
        ],
      },
    },
    {
      name: 'fullName',
      type: 'text',
      hooks: {
        afterRead: [({ siblingData }) => `${siblingData.firstName} ${siblingData.lastName}`],
      },
    },
  ],
}

export const Posts: CollectionConfig = {
  slug: postsSlug,
  versions: { drafts: true },
  access: { read: () => true, update: () => true, readVersions: () => true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'category', type: 'text', required: true, access: { update: () => false } },
    { name: 'owner', type: 'relationship', relationTo: peopleSlug },
    { name: 'ownerName', type: 'text', virtual: 'owner.fullName' },
    { name: 'reviewerNames', type: 'json', virtual: 'reviewers.fullName' },
    { name: 'reviewers', type: 'relationship', relationTo: peopleSlug, hasMany: true },
    {
      name: 'validatedTags',
      type: 'json',
      jsonSchema: {
        uri: 'urn:batch35:tags',
        fileMatch: ['*'],
        schema: { type: 'array', items: { type: 'string' } },
        transforms: [({ jsonSchema }) => ({ ...jsonSchema, description: 'Transformed tags' })],
      },
    },
    {
      name: 'tags',
      type: 'json',
      jsonSchema: [() => ({ type: 'array', items: { type: 'string' } })],
    },
  ],
}
