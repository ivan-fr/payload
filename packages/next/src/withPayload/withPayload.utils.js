/**
 * This was taken and modified from https://github.com/getsentry/sentry-javascript/blob/15256034ee8150a5b7dcb97d23eca1a5486f0cae/packages/nextjs/src/config/util.ts
 *
 * MIT License
 *
 * Copyright (c) 2012 Functional Software, Inc. dba Sentry
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * @param {string | undefined} input
 * @returns {number}
 */
function _parseInt(input) {
  return Number.parseInt(input || '', 10)
}

/**
 * Represents Semantic Versioning object
 * @typedef {Object} SemVer
 * @property {string} [buildmetadata]
 * @property {number} [canaryVersion] - undefined if not a canary version
 * @property {number} [major]
 * @property {number} [minor]
 * @property {number} [patch]
 * @property {string} [prerelease]
 */

// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const SEMVER_REGEXP =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*))*))?(?:\+([0-9a-z-]+(?:\.[0-9a-z-]+)*))?$/i

/**
 * Parses input into a SemVer interface
 * @param {string} input - string representation of a semver version
 * @returns {SemVer}
 */
export function parseSemver(input) {
  const match = input.match(SEMVER_REGEXP) || []
  const major = _parseInt(match[1])
  const minor = _parseInt(match[2])
  const patch = _parseInt(match[3])

  const prerelease = match[4]
  const canaryVersion = prerelease?.startsWith('canary.')
    ? Number.parseInt(prerelease.split('.')[1] || '0', 10)
    : undefined

  return {
    buildmetadata: match[5],
    canaryVersion,
    major: isNaN(major) ? undefined : major,
    minor: isNaN(minor) ? undefined : minor,
    patch: isNaN(patch) ? undefined : patch,
    prerelease: match[4],
  }
}

/**
 * Returns the version of Next.js installed in the project, or undefined if it cannot be determined.
 * @returns {SemVer | undefined}
 */
export function getNextjsVersion() {
  try {
    /** @type {string} */
    let pkgPath

    // Check if we're in ESM or CJS environment
    if (typeof import.meta?.resolve === 'function') {
      // ESM environment - use import.meta.resolve
      const pkgUrl = import.meta.resolve('next/package.json')
      // Use fileURLToPath for proper cross-platform path handling (Windows, macOS, Linux)
      // new URL().pathname returns '/C:/path' on Windows which causes path resolution issues
      pkgPath = fileURLToPath(pkgUrl)
    } else {
      // CJS environment - use require.resolve
      pkgPath = require.resolve('next/package.json')
    }

    const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return parseSemver(pkgJson.version)
  } catch (e) {
    console.error('Payload: Error getting Next.js version', e)
    return undefined
  }
}

/**
 * Returns the Next.js version range that this version of `@payloadcms/next` declares as its peer
 * dependency, or undefined if it cannot be determined.
 * @returns {string | undefined}
 */
export function getSupportedNextjsRange() {
  try {
    // The package root is two directories up from the source, ESM and CJS output alike
    const pkgPath =
      typeof import.meta?.url === 'string'
        ? fileURLToPath(new URL('../../package.json', import.meta.url))
        : path.resolve(__dirname, '../../package.json')
    const range = JSON.parse(readFileSync(pkgPath, 'utf8')).peerDependencies?.next

    return typeof range === 'string' ? range : undefined
  } catch (_err) {
    return undefined
  }
}

/**
 * Compares the release numbers of two versions. Prerelease tags are ignored on purpose, so a
 * canary of a supported release is not reported as unsupported.
 * @param {SemVer} a
 * @param {SemVer} b
 * @returns {number}
 */
function compareReleases(a, b) {
  return (
    (a.major || 0) - (b.major || 0) ||
    (a.minor || 0) - (b.minor || 0) ||
    (a.patch || 0) - (b.patch || 0)
  )
}

const COMPARATOR_REGEXP = /^(>=|<=|>|<|=)?\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/

/**
 * Checks a version against a range made of plain comparators, e.g. `>=16.4.0 <17.0.0` or
 * `>=15.4.0 <16.0.0 || >=16.4.0 <17.0.0`.
 * @param {Object} args
 * @param {string} args.range
 * @param {SemVer} args.version
 * @returns {boolean | undefined} undefined if the version or the range cannot be interpreted
 */
export function isVersionInRange({ range, version }) {
  if (version?.major === undefined) {
    return undefined
  }

  let hasUnknownComparator = false

  const isInRange = range.split('||').some((comparatorSet) => {
    const comparators = comparatorSet
      .trim()
      .replace(/(>=|<=|>|<|=)\s+/g, '$1')
      .split(/\s+/)
      .filter(Boolean)

    return (
      comparators.length > 0 &&
      comparators.every((comparator) => {
        const match = comparator.match(COMPARATOR_REGEXP)

        if (!match || match[0].length !== comparator.length) {
          hasUnknownComparator = true
          return false
        }

        const difference = compareReleases(version, {
          major: _parseInt(match[2]),
          minor: _parseInt(match[3] || '0'),
          patch: _parseInt(match[4] || '0'),
        })

        switch (match[1]) {
          case '<':
            return difference < 0
          case '<=':
            return difference <= 0
          case '>':
            return difference > 0
          case '>=':
            return difference >= 0
          default:
            return difference === 0
        }
      })
    )
  })

  return hasUnknownComparator ? undefined : isInRange
}

/**
 * Returns a warning when the installed Next.js version is outside the range Payload supports, as
 * package managers only print an easy to miss peer dependency warning at install time.
 * @param {Object} args
 * @param {string | undefined} args.range
 * @param {SemVer | undefined} args.version
 * @returns {string | undefined}
 */
export function getUnsupportedNextjsVersionWarning({ range, version }) {
  if (!range || !version || isVersionInRange({ range, version }) !== false) {
    return undefined
  }

  const installedVersion = `${version.major}.${version.minor}.${version.patch}${
    version.prerelease ? `-${version.prerelease}` : ''
  }`

  return `Payload: detected Next.js ${installedVersion}, which is outside the range supported by this version of @payloadcms/next (${range}). Unsupported Next.js versions can break the Admin Panel in ways that are hard to trace back to the version, and may be missing security patches. Install a Next.js version within the supported range to clear this warning.`
}
