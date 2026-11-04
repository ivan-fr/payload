import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  stateIndex: 0,
  effects: [] as (() => void)[],
  ref: { current: null as ((id: string) => Promise<void>) | null },
  save: null as (() => Promise<void>) | null,
  schedule: vi.fn(),
  dateSetter: vi.fn(),
  processing: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const overrides = {
    useState: (initial: unknown) => {
      const index = fixture.stateIndex++
      if (index === 1) return [new Date('2030-01-02T12:00:00Z'), fixture.dateSetter]
      if (index === 5) return [false, fixture.processing]
      if (index === 6 || index === 7) return [[], vi.fn()]
      return [typeof initial === 'function' ? initial() : initial, vi.fn()]
    },
    useRef: () => fixture.ref,
    useEffect: (effect: () => void) => fixture.effects.push(effect),
  }
  return { ...actual, ...overrides, default: { ...actual.default, ...overrides } }
})
vi.mock('sonner', () => ({ toast: { success: fixture.success, error: fixture.error } }))
vi.mock('../../../providers/Config/index.js', () => ({
  useConfig: () => ({
    config: {
      admin: { dateFormat: 'yyyy-MM-dd', timezones: { supportedTimezones: [] } },
      localization: false,
    },
  }),
}))
vi.mock('../../../providers/DocumentInfo/index.js', () => ({
  useDocumentInfo: () => ({ id: 'post', collectionSlug: 'posts' }),
}))
vi.mock('../../../providers/DocumentTitle/index.js', () => ({
  useDocumentTitle: () => ({ title: 'Post' }),
}))
vi.mock('../../../providers/Translation/index.js', () => ({
  useTranslation: () => ({ i18n: {}, t: (key: string) => key }),
}))
vi.mock('../../../providers/ServerFunctions/index.js', () => ({
  useServerFunctions: () => ({
    schedulePublish: fixture.schedule,
    getUpcomingScheduledPublish: async () => [],
  }),
}))
vi.mock('../../Drawer/index.js', () => ({
  Drawer: ({ children }: { children: never }) => createElement(Fragment, null, children),
}))
vi.mock('../../Gutter/index.js', () => ({
  Gutter: ({ children }: { children: never }) => createElement(Fragment, null, children),
}))
vi.mock('../../Button/index.js', () => ({
  Button: ({ onClick }: { onClick: () => Promise<void> }) => {
    fixture.save = onClick
    return null
  },
}))
vi.mock('../../../fields/FieldLabel/index.js', () => ({ FieldLabel: () => null }))
vi.mock('../../../fields/RadioGroup/Radio/index.js', () => ({ Radio: () => null }))
vi.mock('../../DatePicker/index.js', () => ({ DatePickerField: () => null }))
vi.mock('../../ReactSelect/index.js', () => ({ ReactSelect: () => null }))
vi.mock('../../TimezonePicker/index.js', () => ({ TimezonePicker: () => null }))
vi.mock('../../Banner/index.js', () => ({ Banner: () => null }))
vi.mock('../../ShimmerEffect/index.js', () => ({ ShimmerEffect: () => null }))
vi.mock('../../Table/index.js', () => ({ Table: () => null }))
vi.mock('./buildUpcomingColumns.js', () => ({ buildUpcomingColumns: () => [] }))

import { ScheduleDrawer } from './index.js'

describe('schedule drawer mutation results (#19190)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fixture.stateIndex = 0
    fixture.effects = []
    renderToStaticMarkup(createElement(ScheduleDrawer, { slug: 'schedule' }))
    fixture.effects.forEach((effect) => effect())
  })
  for (const action of ['save', 'cancel']) {
    it.each(['result', 'throw'])(
      'should show an error and preserve retry state for ' + action + ' failure: %s',
      async (failure) => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        if (failure === 'result') fixture.schedule.mockResolvedValue({ error: 'Denied' })
        else fixture.schedule.mockRejectedValue(new Error('Denied'))
        try {
          await (action === 'save' ? fixture.save!() : fixture.ref.current!('job'))
          expect(fixture.error).toHaveBeenCalledWith('Denied')
          expect(fixture.success).not.toHaveBeenCalled()
          expect(fixture.dateSetter).not.toHaveBeenCalled()
        } finally {
          vi.restoreAllMocks()
        }
      },
    )
    it('should preserve the ' + action + ' success path', async () => {
      fixture.schedule.mockResolvedValue({ message: 'Success' })
      await (action === 'save' ? fixture.save!() : fixture.ref.current!('job'))
      expect(fixture.success).toHaveBeenCalledOnce()
      expect(fixture.error).not.toHaveBeenCalled()
    })
  }
})
