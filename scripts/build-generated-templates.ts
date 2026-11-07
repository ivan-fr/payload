import { execSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

async function main() {
  // Get all directories in `templates` directory
  const repoRoot = path.resolve(dirname, '..')
  const templatesDir = path.resolve(repoRoot, 'templates')

  const rawTemplateDirs = await fs.readdir(templatesDir, { withFileTypes: true })
  const templateDirnames = rawTemplateDirs
    .filter(
      (dirent) =>
        dirent.isDirectory() && (dirent.name.startsWith('with') || dirent.name == 'blank'),
    )
    .map((dirent) => dirent.name)

  console.log(`Found generated templates: ${templateDirnames}`)

  // Build each template
  for (const template of templateDirnames) {
    const cmd = `cd ${templatesDir}/${template} && pnpm install --ignore-workspace --no-frozen-lockfile && pnpm build`
    console.log(`🔧 Building ${template}...`)
    console.log(`   cmd: ${cmd}\n\n`)
    execSync(cmd, { stdio: 'inherit' })
  }
}
