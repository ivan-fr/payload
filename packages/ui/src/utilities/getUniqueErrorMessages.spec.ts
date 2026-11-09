import { expect, it } from 'vitest'

import { getResponseErrorMessage } from './getResponseErrorMessage.js'
import { getUniqueErrorMessages } from './getUniqueErrorMessages.js'

it('should preserve unique public reasons in response order', () => {
  expect(
    getUniqueErrorMessages({
      errors: [
        { message: 'First' },
        { message: 'Second', isPublic: true },
        { message: 'First' },
        { message: 'Private', isPublic: false },
        null,
        'Malformed',
        { message: 2 },
        { message: '  ' },
      ],
    }),
  ).toEqual(['First', 'Second'])
})
it('should describe private failures with the translated fallback without exposing details', () => {
  expect(
    getUniqueErrorMessages({
      errors: [{ message: 'Private database details', isPublic: false }],
      fallback: 'Something went wrong.',
    }),
  ).toEqual(['Something went wrong.'])
})
it.each([undefined, null, {}, 'error'])(
  'should ignore malformed error containers (%s)',
  (errors) => {
    expect(getUniqueErrorMessages({ errors })).toEqual([])
  },
)
it.each([
  { body: { errors: [{ message: 'Safe' }, { message: 'Safe' }] }, expected: 'Safe' },
  { body: { message: 'Top-level rejection' }, expected: 'Top-level rejection' },
  { body: { errors: [{ message: 'Internal details', isPublic: false }] }, expected: 'Fallback' },
  { body: null, expected: 'Fallback' },
])('should read an error response safely: $expected', async ({ body, expected }) => {
  expect(
    await getResponseErrorMessage({
      fallback: 'Fallback',
      response: Response.json(body, { status: 400 }),
    }),
  ).toBe(expected)
})
it('should retain the fallback for a non-JSON proxy response', async () => {
  expect(
    await getResponseErrorMessage({
      fallback: 'Fallback',
      response: new Response('<html>Bad gateway</html>', { status: 502 }),
    }),
  ).toBe('Fallback')
})
