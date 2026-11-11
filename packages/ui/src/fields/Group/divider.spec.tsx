import { page } from 'vitest/browser'
import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { CollapsibleProvider } from '../../elements/Collapsible/provider.js'
import { RowProvider } from '../Row/provider.js'
import { GroupFieldComponent, GroupProvider } from './index.js'
import '../../css/app.css'
import '../../forms/RenderFields/index.css'

vi.mock('../../forms/Form/context.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../forms/Form/context.js')>()),
  useForm: () => ({ uuid: 'group-test' }),
  useFormSubmitted: () => false,
}))
vi.mock('../../forms/useField/index.js', async () => ({
  FieldContext: (await import('react')).createContext(undefined),
  useField: () => ({ errorPaths: [] }),
}))
vi.mock('../../forms/RenderFields/index.js', () => ({
  RenderFields: ({ parentPath }: { parentPath: string }) => (
    <label>
      Value
      <input name={parentPath} />
    </label>
  ),
}))
vi.mock('../../providers/Translation/index.js', () => ({
  TranslationProvider: ({ children }: { children: React.ReactNode }) => children,
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}))

it.each([320, 400, 1440])(
  'should place an adjacent collapsible group divider in the gap at %spx (#19413)',
  async (width) => {
    await page.viewport(width, 720)

    const screen = await render(
      <CollapsibleProvider isCollapsed={false} toggle={() => {}}>
        <div className="render-fields">
          <Group name="first" />
          <Group name="second" />
        </div>
      </CollapsibleProvider>,
    )
    const first = screen.getByRole('heading', { name: 'first' }).element().closest('.group-field')!
    const title = screen.getByRole('heading', { name: 'second' }).element()
    const second = title.closest('.group-field')!
    const divider = getComputedStyle(second, '::before')
    const dividerTop = second.getBoundingClientRect().top + Number.parseFloat(divider.top)

    expect(getComputedStyle(first, '::before').display).toBe('none')
    expect(divider.borderTopStyle).toBe('solid')
    expect(dividerTop).toBeGreaterThan(first.getBoundingClientRect().bottom)
    expect(dividerTop).toBeLessThan(title.getBoundingClientRect().top)
    expect(title.textContent).toBe('second')
  },
)

it.each(['group', 'row'] as const)('should keep dividers hidden within a %s', async (context) => {
  const Provider = context === 'group' ? GroupProvider : RowProvider
  const screen = await render(
    <CollapsibleProvider isCollapsed={false} toggle={() => {}}>
      <Provider>
        <div className="render-fields">
          <Group name="first" />
          <Group name="second" />
        </div>
      </Provider>
    </CollapsibleProvider>,
  )
  const second = screen.getByRole('heading', { name: 'second' }).element().closest('.group-field')!

  expect(getComputedStyle(second, '::before').display).toBe('none')
})

function Group({ name }: { name: string }) {
  return (
    <GroupFieldComponent field={{ name, type: 'group', fields: [], label: name }} path={name} />
  )
}
