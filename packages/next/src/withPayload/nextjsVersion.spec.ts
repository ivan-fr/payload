import { describe, expect, it } from 'vitest'

import {
  getNextjsVersion,
  getSupportedNextjsRange,
  getUnsupportedNextjsVersionWarning,
  isVersionInRange,
  parseSemver,
} from './withPayload.utils.js'

const range = '>=16.4.0 <17.0.0'

describe('Next.js version support warning', () => {
  it.each(['16.4.0', '16.4.7', '16.12.3', '16.5.0-canary.12'])(
    'should not warn for supported version %s',
    (version) => {
      expect(
        getUnsupportedNextjsVersionWarning({ range, version: parseSemver(version) }),
      ).toBeUndefined()
    },
  )

  it.each(['16.2.1', '16.3.9', '15.4.11', '17.0.0', '17.1.0-canary.1'])(
    'should warn for unsupported version %s and name the version and the supported range',
    (version) => {
      const warning = getUnsupportedNextjsVersionWarning({ range, version: parseSemver(version) })

      expect(warning).toContain(`Next.js ${version}`)
      expect(warning).toContain(range)
    },
  )

  it('should support ranges with alternatives and other comparators', () => {
    const alternatives = '>=15.4.0 <16.0.0 || >=16.4.0 <17.0.0'

    expect(isVersionInRange({ range: alternatives, version: parseSemver('15.4.11') })).toBe(true)
    expect(isVersionInRange({ range: alternatives, version: parseSemver('16.2.1') })).toBe(false)
    expect(isVersionInRange({ range: '> 16.4.0 <= 16.5.0', version: parseSemver('16.5.0') })).toBe(
      true,
    )
    expect(isVersionInRange({ range: '>16.4.0', version: parseSemver('16.4.0') })).toBe(false)
    expect(isVersionInRange({ range: '16.4.1', version: parseSemver('16.4.1') })).toBe(true)
  })

  it('should stay silent when the version or the range cannot be interpreted', () => {
    expect(getUnsupportedNextjsVersionWarning({ range, version: undefined })).toBeUndefined()
    expect(
      getUnsupportedNextjsVersionWarning({ range, version: parseSemver('not-a-version') }),
    ).toBeUndefined()
    expect(
      getUnsupportedNextjsVersionWarning({ range: undefined, version: parseSemver('15.0.0') }),
    ).toBeUndefined()
    expect(
      getUnsupportedNextjsVersionWarning({ range: '^16.4.0', version: parseSemver('15.0.0') }),
    ).toBeUndefined()
    expect(
      getUnsupportedNextjsVersionWarning({ range: 'workspace:*', version: parseSemver('15.0.0') }),
    ).toBeUndefined()
  })

  it('should read the supported range from the package and accept the installed Next.js', () => {
    const supportedRange = getSupportedNextjsRange()

    expect(supportedRange).toEqual(expect.any(String))
    expect(
      getUnsupportedNextjsVersionWarning({ range: supportedRange, version: getNextjsVersion() }),
    ).toBeUndefined()
  })
})
