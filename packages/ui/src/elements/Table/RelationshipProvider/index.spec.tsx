import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RelationshipProvider, useListRelationships } from './index.js'

const config = {
  routes: { api: '/api' },
  collections: ['categories', 'users'].map((slug) => ({ slug, admin: { useAsTitle: 'title' } })),
}
const i18n = { language: 'en' }
let locale = { code: 'en' }
vi.mock('../../../providers/Config/index.js', () => ({ useConfig: () => ({ config }) }))
vi.mock('../../../providers/Translation/index.js', () => ({ useTranslation: () => ({ i18n }) }))
vi.mock('../../../providers/Locale/index.js', () => ({ useLocale: () => locale }))
// Deliver state immediately to deterministically exercise the pending window.
vi.mock('../../../hooks/useDebounce.js', () => ({ useDebounce: (value: unknown) => value }))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let manager: ReturnType<typeof useListRelationships>
const deferred = () => {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function Fixture() {
  manager = useListRelationships()
  return null
}
const render = () =>
  root.render(
    <StrictMode>
      <RelationshipProvider>
        <Fixture />
      </RelationshipProvider>
    </StrictMode>,
  )
const response = ({ id, title = id }: { id: string; title?: string }) =>
  Response.json({ docs: [{ id, title }] })
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  locale = { code: 'en' }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('RelationshipProvider in-flight requests', () => {
  it('should request each pending ID once while another collection loads and new rows register', async () => {
    const firstCategory = deferred()
    const secondCategory = deferred()
    const fetch = vi.fn((url: string) => {
      const parsed = new URL(url, 'http://localhost')
      if (parsed.pathname.endsWith('/users')) return Promise.resolve(response({ id: 'user1' }))
      return parsed.searchParams.get('where[id][in]') === 'cat2'
        ? secondCategory.promise
        : firstCategory.promise
    })
    vi.stubGlobal('fetch', fetch)
    await act(() => render())
    await act(() =>
      manager.getRelationships([
        { relationTo: 'categories', value: 'cat1' },
        { relationTo: 'users', value: 'user1' },
      ]),
    )

    expect(fetch).toHaveBeenCalledTimes(2)
    await act(() =>
      manager.getRelationships([
        { relationTo: 'categories', value: 'cat1' },
        { relationTo: 'categories', value: 'cat2' },
      ]),
    )
    expect(fetch).toHaveBeenCalledTimes(3)
    const categories = fetch.mock.calls
      .map(([url]) => new URL(url, 'http://localhost'))
      .filter((url) => url.pathname.endsWith('/categories'))
    expect(categories.map((url) => url.searchParams.get('where[id][in]'))).toEqual(['cat1', 'cat2'])

    await act(() => {
      secondCategory.resolve(response({ id: 'cat2' }))
      firstCategory.resolve(response({ id: 'cat1' }))
    })
    expect(manager.documents.categories).toMatchObject({
      cat1: { id: 'cat1' },
      cat2: { id: 'cat2' },
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('should load the new locale while an old request is pending and ignore its late response', async () => {
    const old = deferred()
    const fetch = vi.fn((url: string) =>
      new URL(url, 'http://localhost').searchParams.get('locale') === 'en'
        ? old.promise
        : Promise.resolve(response({ id: 'cat1', title: 'Deutsch' })),
    )
    vi.stubGlobal('fetch', fetch)
    await act(() => render())
    await act(() => manager.getRelationships([{ relationTo: 'categories', value: 'cat1' }]))
    locale = { code: 'de' }
    await act(() => render())
    expect(manager.documents.categories.cat1).toMatchObject({ title: 'Deutsch' })
    await act(() => old.resolve(response({ id: 'cat1', title: 'English' })))

    expect(manager.documents.categories.cat1).toMatchObject({ title: 'Deutsch' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  for (const failure of ['network', 'json'] as const) {
    it(`should settle ${failure} errors and allow an explicit retry`, async () => {
      const fetch = vi.fn()
      if (failure === 'network') fetch.mockRejectedValueOnce(new TypeError('Offline'))
      else
        fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.reject(new SyntaxError('Incomplete JSON')),
        })
      fetch.mockResolvedValue(response({ id: 'cat1' }))
      vi.stubGlobal('fetch', fetch)
      await act(() => render())
      await act(() => manager.getRelationships([{ relationTo: 'categories', value: 'cat1' }]))
      expect(manager.documents.categories.cat1).toBe(false)
      await act(() => manager.getRelationships([{ relationTo: 'categories', value: 'cat1' }]))

      expect(manager.documents.categories.cat1).toMatchObject({ id: 'cat1' })
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  }
})
