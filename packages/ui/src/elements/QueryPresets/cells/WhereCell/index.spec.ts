import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { QueryPresetsWhereCell } from './index.js'

describe('query-preset numeric values (#18083)', () => {
  it.each([
    [5, 0],
    ['5', '0'],
    [true, false],
  ])('should render array values without crashing: %j', (...values) => {
    const markup = renderToStaticMarkup(
      React.createElement(QueryPresetsWhereCell, {
        cellData: { or: [{ and: [{ authors: { equals: values } }] }] },
      } as never),
    )

    expect(markup).toContain('Authors equals')
    for (const value of values) expect(markup.toLowerCase()).toContain(String(value).toLowerCase())
  })
})
