import type { ClientConfig } from 'payload'

import { act, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ConfigProvider, PageConfigProvider, useConfig } from './index.js'

const layoutConfig = { collections: [], globals: [], unauthenticated: true } as ClientConfig
const pageConfig = {
  collections: [{ slug: 'posts' }],
  globals: [{ slug: 'settings' }],
} as ClientConfig

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('should retain the focused page DOM when synchronizing an authenticated config (#19490)', async () => {
  const mountedNodes: HTMLButtonElement[] = []
  const observedConfigs: ClientConfig[] = []

  function Page() {
    const ref = useRef<HTMLButtonElement>(null)
    const { config, getEntityConfig } = useConfig()
    const [value, setValue] = useState(0)

    observedConfigs.push(config)
    expect(getEntityConfig({ collectionSlug: 'posts' })).toBe(pageConfig.collections[0])
    expect(getEntityConfig({ globalSlug: 'settings' })).toBe(pageConfig.globals[0])

    useLayoutEffect(() => {
      mountedNodes.push(ref.current!)
      if (mountedNodes.length === 1) {
        ref.current!.focus()
        setValue(1)
      }
    }, [])

    return <button ref={ref}>{value}</button>
  }

  await act(() =>
    root.render(
      <ConfigProvider config={layoutConfig}>
        <PageConfigProvider config={pageConfig}>
          <Page />
        </PageConfigProvider>
      </ConfigProvider>,
    ),
  )

  expect(mountedNodes).toHaveLength(1)
  expect(container.querySelector('button')).toBe(mountedNodes[0])
  expect(document.activeElement).toBe(mountedNodes[0])
  expect(container.textContent).toBe('1')
  expect(observedConfigs.every((config) => config === pageConfig)).toBe(true)
})

it('should retain page input state when the page becomes unauthenticated', async () => {
  function Page() {
    const { config } = useConfig()

    return <input aria-label="Page state" data-unauthenticated={!!config.unauthenticated} />
  }

  const renderPage = async ({ config }: { config: ClientConfig }) => {
    await act(() =>
      root.render(
        <ConfigProvider config={pageConfig}>
          <PageConfigProvider config={config}>
            <Page />
          </PageConfigProvider>
        </ConfigProvider>,
      ),
    )
  }

  await renderPage({ config: pageConfig })

  const input = container.querySelector('input')!

  input.value = 'Retained text'
  input.focus()
  await renderPage({ config: layoutConfig })

  expect(container.querySelector('input')).toBe(input)
  expect(input.value).toBe('Retained text')
  expect(input.dataset.unauthenticated).toBe('true')
  expect(document.activeElement).toBe(input)
})
