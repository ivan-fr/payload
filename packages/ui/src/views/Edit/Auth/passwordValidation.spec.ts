import type { PasswordFieldValidation } from 'payload'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  fields: [] as object[],
  validate: undefined as PasswordFieldValidation | undefined,
}))
vi.mock('../../../providers/Config/index.js', () => ({
  useConfig: () => ({
    config: { routes: { api: '/api' } },
    getEntityConfig: () => ({ fields: fixture.fields }),
  }),
}))
vi.mock('../../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ docPermissions: { create: true, update: true, fields: true } }),
}))
vi.mock('../../../providers/Translation/index.js', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options: object) => JSON.stringify({ key, ...options }),
  }),
}))
vi.mock('../../../providers/Locale/index.js', () => ({ useLocale: () => undefined }))
vi.mock('../../../forms/Form/context.js', () => ({
  useFormFields: () => vi.fn(),
  useFormModified: () => false,
}))
vi.mock('../../../forms/useField/index.js', () => ({
  useField: ({ validate }: { validate: PasswordFieldValidation }) => {
    fixture.validate = validate
    return {}
  },
}))
vi.mock('../../../forms/withCondition/index.js', () => ({
  withCondition: (component: unknown) => component,
}))
vi.mock('../../../fields/Password/input.js', () => ({ PasswordInput: () => null }))
vi.mock('../../../elements/Button/index.js', () => ({ Button: () => null }))
vi.mock('../../../elements/EmailAndUsername/index.js', () => ({
  EmailAndUsernameFields: () => null,
}))
vi.mock('../../../fields/ConfirmPassword/index.js', () => ({ ConfirmPasswordField: () => null }))
vi.mock('../../../fields/Checkbox/index.js', () => ({ CheckboxField: () => null }))
vi.mock('./APIKey.js', () => ({ APIKey: () => null }))

import { PasswordField } from '../../../fields/Password/index.js'
import { Auth } from './index.js'

const renderAuth = () =>
  renderToStaticMarkup(
    createElement(Auth, {
      collectionSlug: 'users',
      email: '',
      username: '',
      loginWithUsername: false,
      operation: 'create',
      readOnly: false,
      requirePassword: true,
      setValidateBeforeSubmit: vi.fn(),
    }),
  )
const validate = (value: string) => fixture.validate!(value, {} as never)

describe('admin password overrides (#19131)', () => {
  beforeEach(() => {
    fixture.fields = []
    fixture.validate = undefined
  })
  it('should enforce the configured minimum and maximum through the real Auth and PasswordField', () => {
    fixture.fields = [{ name: 'password', type: 'text', hidden: true, minLength: 8, maxLength: 12 }]
    renderAuth()
    expect(validate('ab')).toBe(JSON.stringify({ key: 'validation:longerThanMin', minLength: 8 }))
    expect(validate('abc')).toBe(JSON.stringify({ key: 'validation:longerThanMin', minLength: 8 }))
    expect(validate('longenough')).toBe(true)
    expect(validate('far-too-long-password')).toBe(
      JSON.stringify({ key: 'validation:shorterThanMax', maxLength: 12 }),
    )
  })
  it('should keep the default minimum when no password override exists', () => {
    renderAuth()
    expect(validate('ab')).toBe(JSON.stringify({ key: 'validation:longerThanMin', minLength: 3 }))
    expect(validate('abc')).toBe(true)
    expect(validate('')).toBe(JSON.stringify({ key: 'validation:required' }))
  })
  it('should respect a zero minimum and find overrides in unnamed tabs', () => {
    fixture.fields = [
      {
        type: 'tabs',
        tabs: [{ label: 'Auth', fields: [{ name: 'password', type: 'text', minLength: 0 }] }],
      },
    ]
    renderAuth()
    expect(validate('a')).toBe(true)
  })
  it('should preserve explicitly supplied custom validation', () => {
    const custom = vi.fn().mockReturnValue('Custom error')
    renderToStaticMarkup(
      createElement(PasswordField, {
        field: { name: 'password', minLength: 8, required: true },
        path: 'password',
        validate: custom,
      }),
    )
    expect(validate('a')).toBe('Custom error')
    expect(custom).toHaveBeenCalledWith('a', expect.objectContaining({ required: true }))
  })
})
