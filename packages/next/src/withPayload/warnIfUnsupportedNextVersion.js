import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { satisfies, valid } from 'semver'

const warnedVersions = new Set()

/** Warn once per unsupported version without preventing the app from starting. */
export function warnIfUnsupportedNextVersion() {
  try {
    const resolve =
      typeof require === 'function' ? require.resolve : createRequire(import.meta.url).resolve
    const { version } = JSON.parse(readFileSync(resolve('next/package.json'), 'utf8'))
    const { peerDependencies } = JSON.parse(
      readFileSync(
        typeof __dirname === 'string'
          ? path.resolve(__dirname, '../../package.json')
          : new URL('../../package.json', import.meta.url),
        'utf8',
      ),
    )
    const range = peerDependencies.next
    const warningKey = `${version}:${range}`

    if (!valid(version) || satisfies(version, range) || warnedVersions.has(warningKey)) {
      return
    }

    warnedVersions.add(warningKey)
    console.warn(
      `Payload: installed Next.js ${version} is outside @payloadcms/next's supported peer range (${range}). Install a Next.js version within that range to avoid compatibility failures.`,
    )
  } catch {
    // Version discovery is best-effort; package resolution must not prevent config loading.
  }
}
