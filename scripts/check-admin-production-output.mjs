import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const root = resolve(process.argv[2] || 'admin-panel/dist')
const forbiddenNames = new Set(['design-preview.html', '.design-preview'])
const failures = []

async function visit(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name)
    if (forbiddenNames.has(name) || name.endsWith('.map')) failures.push(path)
    if (name.endsWith('.js') && (await readFile(path, 'utf8')).includes('DEV_ONLY_ADMIN_GALLERY_SENTINEL')) failures.push(path)
    if ((await stat(path)).isDirectory()) await visit(path)
  }
}

await visit(root)
if (failures.length) {
  console.error(`Development-only files found in production output:\n${failures.join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Production output contains no source maps or design-preview files.')
}
