import type { FormState } from 'payload'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  effects: [] as { effect: () => void; deps?: unknown[] }[],
  dispatch: vi.fn(),
  state: {} as FormState,
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void, deps: unknown[]) => fixture.effects.push({ effect, deps }),
  useReducer: () => [fixture.state, fixture.dispatch],
}))
vi.mock('../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ docConfig: {} }),
}))
vi.mock('../../providers/DocumentTitle/index.js', () => ({ useDocumentTitle: () => ({}) }))
vi.mock('../../providers/Auth/index.js', () => ({ useAuth: () => ({ refreshCookie: vi.fn() }) }))
vi.mock('../../providers/Config/index.js', () => ({
  useConfig: () => ({ config: { routes: { api: '/api' }, admin: {}, localization: false } }),
}))
vi.mock('../../providers/FormErrorHandler/index.js', () => ({ useFormErrorHandler: () => vi.fn() }))
vi.mock('../../providers/Locale/index.js', () => ({ useLocale: () => ({ code: 'en' }) }))
vi.mock('../../providers/Operation/index.js', () => ({ useOperation: () => 'update' }))
vi.mock('../../providers/RouterAdapter/index.js', () => ({ useRouter: () => ({}) }))
vi.mock('../../providers/RouteTransition/index.js', () => ({
  useRouteTransition: () => ({ startRouteTransition: vi.fn() }),
}))
vi.mock('../../providers/ServerFunctions/index.js', () => ({
  useServerFunctions: () => ({ getFormState: vi.fn() }),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: {}, t: (key: string) => key }),
}))
vi.mock('../../providers/UploadHandlers/index.js', () => ({
  useUploadHandlers: () => ({ getUploadHandler: vi.fn() }),
}))
vi.mock('../../hooks/useEffectEvent.js', () => ({ useEffectEvent: (fn: unknown) => fn }))
vi.mock('../../hooks/useDebouncedEffect.js', () => ({ useDebouncedEffect: vi.fn() }))
vi.mock('../../hooks/useThrottledEffect.js', () => ({ useThrottledEffect: vi.fn() }))

import { Form } from './index.js'

describe('form initial state effect replay (#19215)', () => {
  it('should apply a supplied initial state once when mount effects are replayed', () => {
    fixture.state = { images: { value: ['initial'] } }
    fixture.effects = []
    fixture.dispatch.mockClear()
    renderToStaticMarkup(createElement(Form, { initialState: fixture.state, el: 'div' }))
    const entry = fixture.effects.find(({ deps }) => deps?.[0] === fixture.state)!
    expect(entry).toBeDefined()
    entry.effect()
    // Simulate a local edit, then a Strict Mode / Activity effect reconnect.
    fixture.dispatch.mockClear()
    fixture.state.images!.value = ['initial', 'added']
    entry.effect()
    expect(fixture.dispatch).not.toHaveBeenCalled()
  })
})
