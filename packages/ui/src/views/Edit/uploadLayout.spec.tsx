import { page } from 'vitest/browser'
import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

import '../../css/app.css'
import './index.css'

// Exercise the edit view's layout contract with an intrinsically wide custom preview.
it.each([320, 400, 1440])(
  'should contain a wide preview and preserve editable fields at %spx (#19412)',
  async (width) => {
    await page.viewport(width, 720)

    const screen = await render(
      <div className="collection-edit__form">
        <div className="collection-edit__main-wrapper collection-edit__main-wrapper--has-upload-panel">
          <div className="collection-edit__main">
            <div className="document-fields">
              <label className="field-type">
                Alt
                <input style={{ width: '100%' }} />
              </label>
            </div>
          </div>
          <div className="file-manager">
            <div
              aria-label="Spreadsheet preview"
              role="region"
              style={{ overflow: 'auto' }}
              tabIndex={0}
            >
              <table style={{ width: 2400 }}>
                <tbody>
                  <tr>
                    <td style={{ minWidth: 2400 }}>Wide spreadsheet</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>,
    )
    const field = screen.getByRole('textbox', { name: 'Alt' })
    const preview = screen.getByRole('region', { name: 'Spreadsheet preview' }).element()
    const manager = preview.parentElement!

    expect(manager.getBoundingClientRect().width).toBeLessThanOrEqual(width)
    expect(field.element().getBoundingClientRect().width).toBeGreaterThan(width / 4)
    expect(preview.scrollWidth).toBeGreaterThan(preview.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
    await field.fill('Accessible preview')
    await expect.element(field).toHaveValue('Accessible preview')
  },
)
