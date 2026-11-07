import type { FormState } from 'payload'

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { fieldReducer } from '../../../forms/Form/fieldReducer.js'
import { APIKey } from './APIKey.js'

const fixture = vi.hoisted(() => ({
  fields: {} as FormState,
  id: 1 as number | undefined,
  submitCount: 0,
  dispatch: undefined as undefined | ((action: any) => void),
}))
vi.mock('@faceless-ui/modal', () => ({ useModal: () => ({ toggleModal: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../../providers/Config/index.js', () => ({
  useConfig: () => ({
    config: { routes: { api: '/api', admin: '/admin' } },
    getEntityConfig: () => ({ fields: [{ name: 'apiKey', type: 'text', label: 'API Key' }] }),
  }),
}))
vi.mock('../../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({
    id: fixture.id,
    collectionSlug: 'users',
    setData: vi.fn(),
    setLastUpdateTime: vi.fn(),
  }),
}))
vi.mock('../../../providers/Translation/index.js', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}))
vi.mock('../../../providers/Locale/index.js', () => ({ useLocale: () => undefined }))
vi.mock('../../../forms/Form/context.js', () => ({
  useFormFields: (selector) => selector([fixture.fields, fixture.dispatch]),
  useFormSuccessfulSubmitCount: () => fixture.submitCount,
}))
vi.mock('../../../forms/useField/index.js', () => ({
  useField: ({ path }) => ({
    value: fixture.fields[path]?.value,
    setValue: (value) => {
      fixture.fields = { ...fixture.fields, [path]: { ...fixture.fields[path], value } }
    },
  }),
}))
vi.mock('../../../elements/Button/index.js', () => ({
  Button: ({ children, id, onClick, disabled }) => (
    <button disabled={disabled} id={id} onClick={onClick}>
      {children}
    </button>
  ),
}))
vi.mock('../../../elements/ConfirmationModal/index.js', () => ({
  ConfirmationModal: ({ onConfirm }) => (
    <button id="confirm-revoke" onClick={onConfirm}>
      Confirm revoke
    </button>
  ),
}))
vi.mock('./APIKeyGenerationModal.js', () => ({
  APIKeyGenerationModal: ({ id, setKey }) => (
    <button id={id} onClick={() => setKey()}>
      Generate
    </button>
  ),
}))
vi.mock('../../../elements/CopyToClipboard/index.js', () => ({ CopyToClipboard: () => null }))
vi.mock('../../../elements/Spinner/index.js', () => ({ Spinner: () => null }))
vi.mock('../../../fields/FieldDescription/index.js', () => ({ FieldDescription: () => null }))

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(() => {
  fixture.fields = {
    apiKey: { initialValue: undefined, value: undefined, customComponents: { Field: null } },
    apiKeyLast4: { value: '1234' },
  }
  fixture.id = 1
  fixture.submitCount = 0
  fixture.dispatch = (action) => {
    fixture.fields = fieldReducer(fixture.fields, action)
  }
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ doc: { apiKeyLast4: '5678' } }))),
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it.each(['regenerate-api-key', 'confirm-revoke'])(
  'should retain the hidden server Field slot after %s (#18335)',
  async (buttonID) => {
    await act(() => root.render(<APIKey />))
    await act(async () => {
      container.querySelector<HTMLButtonElement>(`#${buttonID}`)!.click()
    })

    expect(fixture.fields.apiKey?.customComponents).toHaveProperty('Field', null)
    expect(fixture.fields.apiKey?.value).toBeUndefined()
    expect(fixture.fields.apiKey?.initialValue).toBeUndefined()
  },
)

it('should preserve the Field slot when a new user saves a generated API key (#18335)', async () => {
  fixture.id = undefined
  fixture.fields.apiKeyLast4 = { value: null }
  await act(() => root.render(<APIKey />))
  await act(async () => {
    container.querySelector<HTMLButtonElement>('#generate-api-key')!.click()
  })
  expect(fixture.fields.apiKey?.value).toBeTruthy()
  fixture.submitCount++
  await act(() => root.render(<APIKey />))

  expect(fixture.fields.apiKey?.customComponents).toHaveProperty('Field', null)
  expect(fixture.fields.apiKey?.value).toBeUndefined()
})

it('should leave the key field unchanged when persistence fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('Failed', { status: 500 })),
  )
  const originalField = fixture.fields.apiKey
  await act(() => root.render(<APIKey />))
  await act(async () => {
    container.querySelector<HTMLButtonElement>('#confirm-revoke')!.click()
  })

  expect(fixture.fields.apiKey).toBe(originalField)
  expect(fixture.fields.apiKeyLast4?.value).toBe('1234')
})
