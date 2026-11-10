import { describe, expect, it } from 'vitest'

import { getSearchWithListQuery } from './getSearchWithListQuery.js'

describe('getSearchWithListQuery', () => {
  it('should preserve route parameters while replacing list-owned parameters', () => {
    const search = getSearchWithListQuery({
      currentSearch: '?view=hierarchy&locale=fr&page=4&sort=title',
      query: {
        limit: 20,
        page: 2,
        sort: '-updatedAt',
      },
    })

    expect(search).toBe('?view=hierarchy&locale=fr&limit=20&page=2&sort=-updatedAt')
  })

  it('should remove stale list-owned parameters omitted from the resolved query', () => {
    const search = getSearchWithListQuery({
      currentSearch: '?view=all&groupBy=organization&page=3',
      query: {
        limit: 10,
      },
    })

    expect(search).toBe('?view=all&limit=10')
  })

  it('should update explicit custom refinements without replacing unrelated custom parameters', () => {
    const search = getSearchWithListQuery({
      currentSearch: '?view=all&tab=featured&scope=published',
      query: {
        scope: 'draft',
      },
      updatedQuery: {
        scope: 'draft',
      },
    })

    expect(search).toBe('?view=all&tab=featured&scope=draft')
  })

  it('should serialize structured list parameters for the URL', () => {
    const search = getSearchWithListQuery({
      currentSearch: '?view=all',
      query: {
        columns: ['title', 'updatedAt'],
        queryByGroup: {
          organization: {
            page: 2,
          },
        },
      },
    })

    expect(search).toBe(
      '?view=all&columns=%5B%22title%22%2C%22updatedAt%22%5D&queryByGroup=%7B%22organization%22%3A%7B%22page%22%3A2%7D%7D',
    )
  })
})

it('should keep already serialized columns stable across back navigation, sort and refresh (#16659)', () => {
  let currentSearch = '?columns=%5B%22title%22%2C%22updatedAt%22%5D'
  for (let refresh = 0; refresh < 10; refresh++) {
    const columns = new URLSearchParams(currentSearch).get('columns')
    currentSearch = getSearchWithListQuery({
      currentSearch,
      query: { columns, sort: 'title' } as never,
    })
    expect(new URLSearchParams(currentSearch).get('columns')).toBe('["title","updatedAt"]')
  }
})

it('should recover previously nested JSON and keep grouped query state stable (#16659)', () => {
  let columns = JSON.stringify(['title'])
  for (let count = 0; count < 4; count++) columns = JSON.stringify(columns)
  const search = getSearchWithListQuery({
    currentSearch: '?locale=fr',
    query: { columns, queryByGroup: JSON.stringify({ category: { page: 2 } }) } as never,
  })
  expect(new URLSearchParams(search).get('columns')).toBe('["title"]')
  expect(new URLSearchParams(search).get('queryByGroup')).toBe('{"category":{"page":2}}')
  expect(new URLSearchParams(search).get('locale')).toBe('fr')
})
