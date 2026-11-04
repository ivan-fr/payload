import type { ReactElement } from 'react'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  state: undefined as undefined | { src?: string; hasError: boolean },
  push: vi.fn(),
}))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const hooks = {
    useId: () => 'selection',
    useState: (initial: { src?: string; hasError: boolean }) => {
      fixture.state ??= initial
      return [
        fixture.state,
        (value: typeof initial) => {
          fixture.state = value
        },
      ]
    },
  }
  return { ...actual, ...hooks, default: { ...actual.default, ...hooks } }
})
vi.mock('../../providers/RouterAdapter/index.js', () => ({
  useRouter: () => ({ push: fixture.push }),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../Link/index.js', () => ({ Link: () => null }))
import { DocumentCard } from './index.js'

const render = ({ src }: { src?: string } = {}) =>
  DocumentCard({
    title: 'File',
    thumbnail: src ? { src } : undefined,
    placeholder: 'Preview',
    href: '/file',
    onSelect: vi.fn(),
  }) as ReactElement<{
    children: ReactElement<{ className: string; onError?: () => void; children: unknown }>[]
    role: string
  }>

describe('document-card failed thumbnails (#19181)', () => {
  beforeEach(() => {
    fixture.state = undefined
  })
  it('should show the supplied placeholder after an error and retain card semantics', () => {
    const card = render({ src: '/file.pdf' })
    const image = card.props.children[0]
    expect(image.type).toBe('img')
    expect(image.props.onError).toBeTypeOf('function')
    image.props.onError!()
    const next = render({ src: '/file.pdf' })
    expect(next.props.children[0].type).toBe('div')
    expect(next.props.children[0].props.className).toContain('document-card__thumbnail--empty')
    expect(next.props.children[0].props.children).toBe('Preview')
    expect(next.props.role).toBe('button')
  })
  it('should retry on a different source, including a return to a previously failed source', () => {
    render({ src: '/bad' }).props.children[0].props.onError!()
    expect(render({ src: '/good' }).props.children[0].type).toBe('img')
    expect(render({ src: '/bad' }).props.children[0].type).toBe('img')
  })
  it('should handle a removed thumbnail and subsequent replacement', () => {
    render({ src: '/bad' }).props.children[0].props.onError!()
    expect(render().props.children[0].type).toBe('div')
    expect(render({ src: '/bad' }).props.children[0].type).toBe('img')
  })
})
