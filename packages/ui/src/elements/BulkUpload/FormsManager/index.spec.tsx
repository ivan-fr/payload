import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FormsManagerProvider, useFormsManager } from './index.js'

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  onSuccess: vi.fn(),
  setSuccessfullyUploaded: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  upload: vi.fn(),
  getUploadHandler: vi.fn(),
  initialForms: [] as any[],
  getFormState: vi.fn(),
}))
const config = { routes: { api: '/api' }, collections: [{ slug: 'media', upload: {} }] }
const getEntityConfig = () => config.collections[0]
const getFormState = (args: unknown) => mocks.getFormState(args)
const getDocumentSlots = async () => ({})
const t = (key: string) => key
const i18n = { language: 'en' }
const noop = () => {}
vi.mock('../../../providers/Config/index.js', () => ({
  useConfig: () => ({ config, getEntityConfig }),
}))
vi.mock('../../../providers/Translation/index.js', () => ({ useTranslation: () => ({ t, i18n }) }))
vi.mock('../../../providers/Locale/index.js', () => ({ useLocale: () => undefined }))
vi.mock('../../../providers/ServerFunctions/index.js', () => ({
  useServerFunctions: () => ({ getFormState, getDocumentSlots }),
}))
vi.mock('../../../providers/UploadHandlers/index.js', () => ({
  useUploadHandlers: () => ({ getUploadHandler: mocks.getUploadHandler }),
}))
vi.mock('@faceless-ui/modal', () => ({ useModal: () => ({ closeModal: mocks.close }) }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('../../Loading/index.js', () => ({ LoadingOverlay: () => null }))
vi.mock('../../LoadingOverlay/index.js', () => ({
  useLoadingOverlay: () => ({ toggleLoadingOverlay: noop }),
}))
vi.mock('../../Toasts/fieldErrors.js', () => ({ FieldErrorsToast: () => null }))
vi.mock('../index.js', () => ({
  useBulkUpload: () => ({
    collectionSlug: 'media',
    initialForms: mocks.initialForms,
    modalSlug: 'uploads',
    onSuccess: mocks.onSuccess,
    selectableCollections: ['media'],
    setCollectionSlug: noop,
    setInitialFiles: noop,
    setInitialForms: noop,
    setSuccessfullyUploaded: mocks.setSuccessfullyUploaded,
  }),
}))

let manager: ReturnType<typeof useFormsManager>
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
function Fixture() {
  manager = useFormsManager()
  manager.getFormDataRef.current = () => manager.forms[manager.activeIndex]?.formState || {}
  return <div>{manager.forms.length}</div>
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // Next/TanStack inject these routing constants; the browser test runner does not.
  if (typeof process === 'undefined') {
    vi.stubGlobal('process', { env: { NEXT_BASE_PATH: '', NEXT_TRAILING_SLASH: 'false' } })
  }
  vi.clearAllMocks()
  mocks.getFormState.mockReset().mockResolvedValue({ state: {} })
  mocks.getUploadHandler.mockReturnValue(undefined)
  mocks.initialForms = ['first.txt', 'second.txt'].map((name, index) => ({
    file: new File(['data'], name, { type: 'text/plain' }),
    formID: String(index),
  }))
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) =>
      String(url).includes('/access')
        ? Promise.resolve(Response.json({ create: true, update: true }))
        : mocks.upload(url, options),
    ),
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

describe('bulk upload retry queue', () => {
  for (const failure of ['network', 'response', 'handler'] as const) {
    it(`should keep a ${failure} failure for retry and count only the saved document`, async () => {
      if (failure === 'handler') {
        const handler = vi
          .fn()
          .mockRejectedValueOnce(new Error('Direct upload interrupted'))
          .mockResolvedValue({ filename: 'second.txt' })
        mocks.getUploadHandler.mockReturnValue(handler)
        mocks.upload.mockResolvedValue(Response.json({ doc: { id: 2 } }, { status: 201 }))
      } else if (failure === 'response') {
        mocks.upload
          .mockResolvedValueOnce({
            status: 201,
            json: () => Promise.reject(new SyntaxError('Interrupted response')),
          })
          .mockResolvedValueOnce(Response.json({ doc: { id: 2 } }, { status: 201 }))
      } else {
        mocks.upload
          .mockRejectedValueOnce(new TypeError('Failed to fetch'))
          .mockResolvedValueOnce(Response.json({ doc: { id: 2 } }, { status: 201 }))
      }
      await act(async () => {
        root.render(
          <FormsManagerProvider>
            <Fixture />
          </FormsManagerProvider>,
        )
      })
      expect(manager.forms).toHaveLength(2)
      await act(() => manager.saveAllDocs())

      expect(manager.forms).toHaveLength(1)
      expect(manager.forms[0]).toMatchObject({ formID: '0', errorCount: 1 })
      expect((manager.forms[0].formState.file.value as File).name).toBe('first.txt')
      expect(mocks.success).toHaveBeenCalledWith('Successfully saved 1 files')
      expect(mocks.onSuccess).toHaveBeenCalledWith(
        [{ collectionSlug: 'media', doc: { id: 2 }, formID: '1' }],
        1,
      )
      expect(mocks.close).not.toHaveBeenCalled()

      mocks.getUploadHandler.mockReturnValue(undefined)
      mocks.upload.mockResolvedValue(Response.json({ doc: { id: 1 } }, { status: 201 }))
      await act(() => manager.saveAllDocs())

      expect(manager.forms).toHaveLength(0)
      expect(mocks.close).toHaveBeenCalledWith('uploads')
      expect(mocks.onSuccess).toHaveBeenLastCalledWith(
        [{ collectionSlug: 'media', doc: { id: 1 }, formID: '0' }],
        0,
      )
    })
  }
})

describe('bulk upload conditions before submission (#18999)', () => {
  it('should refresh every pending form without triggering validation and retain file values and upload edits', async () => {
    mocks.initialForms = mocks.initialForms.map((form) => ({
      ...form,
      initialState: {
        isDecorative: { value: false },
        alt: { value: 'Description', passesCondition: true },
      },
    }))
    await act(async () =>
      root.render(
        <FormsManagerProvider>
          <Fixture />
        </FormsManagerProvider>,
      ),
    )
    expect(manager.forms).toHaveLength(2)
    await act(() => manager.updateUploadEdits({ focalPoint: { x: 25, y: 75 } } as never))
    mocks.getFormState.mockClear().mockImplementation(async ({ formState, skipValidation }) => ({
      state: {
        ...formState,
        alt: { ...formState.alt, passesCondition: !formState.isDecorative.value },
        ...(skipValidation ? {} : { required: { valid: false } }),
      },
    }))

    await act(() => manager.bulkUpdateForm({ isDecorative: true }))

    expect(mocks.getFormState).toHaveBeenCalledTimes(2)
    expect(mocks.getFormState).toHaveBeenCalledWith(
      expect.objectContaining({ skipValidation: true }),
    )
    expect(manager.hasSubmitted).toBe(false)
    for (const form of manager.forms) {
      expect(form.formState.alt.passesCondition).toBe(false)
      expect(form.formState.file.value).toBeInstanceOf(File)
      expect(form.errorCount).toBe(0)
    }
    expect(manager.forms[0].uploadEdits).toEqual({ focalPoint: { x: 25, y: 75 } })

    await act(() => manager.bulkUpdateForm({ isDecorative: false }))
    expect(manager.forms.every((form) => form.formState.alt.passesCondition)).toBe(true)

    mocks.upload.mockImplementation(() =>
      Promise.resolve(
        Response.json({ errors: [{ message: 'Temporary failure' }] }, { status: 400 }),
      ),
    )
    await act(() => manager.saveAllDocs())
    expect(manager.hasSubmitted).toBe(true)
    mocks.getFormState.mockClear()
    await act(() => manager.bulkUpdateForm({ isDecorative: true }))
    expect(mocks.getFormState).toHaveBeenCalledWith(
      expect.objectContaining({ skipValidation: false }),
    )
    expect(manager.forms.every((form) => form.errorCount === 1)).toBe(true)
  })
})
