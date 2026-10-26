// Comprueba que todas las Edge Functions compilan ANTES de desplegarlas.
// Un error de sintaxis no se ve hasta que la función arranca en Supabase, y
// entonces solo da un "BOOT_ERROR: Function failed to start".
//
//   node supabase/check-functions.mjs
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import process from 'node:process'

const here = dirname(fileURLToPath(import.meta.url))

// esbuild viene con Vite, en el panel. Se carga con require y no con import
// porque en Windows import() exige una URL file://, no una ruta absoluta.
const require = createRequire(import.meta.url)
const { build } = require(join(here, '..', 'admin-panel', 'node_modules', 'esbuild'))

const functionsDir = join(here, 'functions')
const names = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(functionsDir, entry.name, 'index.ts')))
  .map((entry) => entry.name)

let failed = 0

for (const name of names) {
  try {
    const source = readFileSync(join(functionsDir, name, 'index.ts'), 'utf8')
    if (/console\.(?:log|info|debug)\s*\(/.test(source)) {
      throw new Error('Usa solo errores estructurados y mínimos; console.log/info/debug aumenta la ingesta y puede filtrar datos.')
    }
    // Incluye helpers locales; los imports remotos quedan externos y no se descargan.
    await build({
      entryPoints: [join(functionsDir, name, 'index.ts')],
      bundle: true,
      external: ['https://*','http://*','npm:*'],
      write: false,
      loader: { '.ts': 'ts' },
      logLevel: 'silent',
    })
    console.log(`  ok    ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  FALLA ${name}`)
    const messages = error.errors ?? [{ text:error.message }]
    for (const message of messages) {
      const where = message.location ? `linea ${message.location.line}` : ''
      console.error(`        ${message.text} ${where}`)
    }
  }
}

console.log(`\n${names.length - failed}/${names.length} funciones compilan`)
process.exit(failed > 0 ? 1 : 0)
