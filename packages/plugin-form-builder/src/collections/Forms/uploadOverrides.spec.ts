import type { Block, BlocksField } from 'payload'
import type { FormBuilderPluginConfig } from '../../types.js'

import { describe, expect, it } from 'vitest'

import { generateFormCollection } from './index.js'

const getUploadBlock = ({ upload }: { upload: FormBuilderPluginConfig['fields']['upload'] }) => {
  const form = generateFormCollection({ fields: { upload }, uploadCollections: ['media'] }, [
    {
      slug: 'media',
      labels: { singular: { en: 'Media', fr: 'Média' }, plural: 'Media' },
      fields: [],
      upload: true,
    },
  ])
  return (
    form.fields.find((field) => 'name' in field && field.name === 'fields') as BlocksField
  ).blocks.find((block): block is Block => typeof block !== 'string' && block.slug === 'upload')
}

describe('upload block overrides (#16394)', () => {
  it('should apply custom labels and admin metadata without losing upload collections', () => {
    const block = getUploadBlock({
      upload: {
        labels: { singular: 'Custom upload', plural: 'Custom uploads' },
        admin: { group: 'Custom' },
      },
    })!
    expect(block.labels).toEqual({ singular: 'Custom upload', plural: 'Custom uploads' })
    expect(block.admin?.group).toBe('Custom')
    expect(block.fields).toContainEqual(
      expect.objectContaining({
        name: 'uploadCollection',
        options: [{ label: { en: 'Media', fr: 'Média' }, value: 'media' }],
      }),
    )
  })
  it('should honor a replacement fields array and leave subsequent factories unchanged', () => {
    const fields = [{ name: 'custom', type: 'text' as const }]
    expect(getUploadBlock({ upload: { fields } })?.fields).toEqual(fields)
    expect(getUploadBlock({ upload: true })?.fields).toContainEqual(
      expect.objectContaining({ name: 'uploadCollection' }),
    )
  })
  it('should retain disabled upload behavior', () => {
    expect(getUploadBlock({ upload: false })).toBeUndefined()
  })
})
