import type { JoinQuery, Payload } from 'payload'
import type { Config } from '../payload-types.js'

import { expect, test } from 'tstyche'

declare const payload: Payload

test('should allow the global join opt-out for collections without generated joins (#17904)', () => {
  expect<JoinQuery<'pages'>>().type.toBe<false>()
  expect<{}>().type.not.toBeAssignableTo<JoinQuery<'pages'>>()
  expect<'pages'>().type.toBeAssignableTo<keyof Config['collections']>()
  void payload.find({ collection: 'pages', joins: false })
  void payload.findByID({ collection: 'pages', id: 1, joins: false })
})

test('should retain generated join objects and false for collections with joins', () => {
  expect<JoinQuery<'pages-categories'>>().type.toBeAssignableFrom<false>()
  expect<JoinQuery<'pages-categories'>>().type.toBeAssignableFrom<{ relatedPages: { limit: 2 } }>()
  expect<{ missingJoin: false }>().type.not.toBeAssignableTo<JoinQuery<'pages-categories'>>()
})
