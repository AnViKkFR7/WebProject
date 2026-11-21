#!/usr/bin/env node
// Optimiza las fotos antiguas de items-media sin cambiar sus URLs.
// Guía completa: database/maintenance/OPTIMIZE_LEGACY_MEDIA.md
//
//   node scripts/optimize-legacy-media.mjs                 → solo informe (no toca nada)
//   node scripts/optimize-legacy-media.mjs --apply         → optimiza
//   node scripts/optimize-legacy-media.mjs --restore       → deshace (sube los originales)
// Opciones: --min-kb=500  --limit=10  --company=<uuid>
//
// Credenciales: database/local/media-optimizer.env (no se sube a git) con
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SECRET_KEY=sb_secret_...   (o la service_role antigua)
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUCKET, listBucketFiles, selectCandidates, optimizeFiles, restoreFiles, formatBytes } from './lib/legacyMedia.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOCAL = join(ROOT, 'database', 'local')
const BACKUP_DIR = join(LOCAL, 'media-backup')
const MANIFEST = join(BACKUP_DIR, 'manifest.json')

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=')
  return [key, value ?? true]
}))
const apply = args.apply === true
const restore = args.restore === true
const minBytes = Number(args['min-kb'] ?? 500) * 1024
const limit = args.limit ? Number(args.limit) : Infinity
const company = typeof args.company === 'string' ? args.company : null

async function loadEnv() {
  const env = { ...process.env }
  try {
    const text = await readFile(join(LOCAL, 'media-optimizer.env'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* sin archivo: se usan las variables de entorno */ }
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en database/local/media-optimizer.env')
    process.exit(1)
  }
  return { url, key }
}

const readManifest = async () => { try { return JSON.parse(await readFile(MANIFEST, 'utf8')) } catch { return {} } }

const backup = {
  async save(path, buffer, contentType) {
    const target = join(BACKUP_DIR, ...path.split('/'))
    const manifest = await readManifest()
    if (!manifest[path]) {
      try { await access(target) } catch {
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, buffer)
      }
      manifest[path] = { contentType, size: buffer.length, savedAt: new Date().toISOString() }
      await writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
    }
  },
}

async function titlesFor(supabase, paths) {
  const ids = [...new Set(paths.map(path => path.split('/')[1]))]
  const titles = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from('items').select('id,title,companies(name)').in('id', ids.slice(i, i + 100))
    for (const item of data ?? []) titles.set(item.id, `${item.companies?.name ?? '?'} · ${item.title}`)
  }
  return titles
}

const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`

async function main() {
  const { url, key } = await loadEnv()
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const storage = supabase.storage

  if (restore) {
    const manifest = await readManifest()
    const paths = Object.keys(manifest).filter(path => !company || path.startsWith(`${company}/`))
    if (paths.length === 0) return console.log('No hay copias de seguridad que restaurar.')
    if (!args.yes) {
      console.log(`Se restaurarían ${paths.length} originales. Repite con --restore --yes para hacerlo.`)
      return
    }
    const entries = await Promise.all(paths.map(async path => ({
      path, contentType: manifest[path].contentType, buffer: await readFile(join(BACKUP_DIR, ...path.split('/'))),
    })))
    await restoreFiles(entries, { storage, log: row => console.log(row.status.padEnd(10), row.path) })
    return
  }

  console.log(apply ? '>> MODO APLICAR: se reemplazarán las fotos (con copia local).' : '>> MODO INFORME: no se sube ni se cambia nada.')
  const files = await listBucketFiles(storage)
  const candidates = selectCandidates(files, { minBytes, company }).slice(0, limit)
  const titles = await titlesFor(supabase, candidates.map(file => file.path))
  console.log(`${files.length} archivos en ${BUCKET}; ${candidates.length} JPG/PNG de ${formatBytes(minBytes)} o más.\n`)

  const results = await optimizeFiles(candidates, {
    storage, apply, backup,
    log: row => console.log(
      `${row.status.padEnd(16)} ${formatBytes(row.size).padStart(9)} → ${row.after ? formatBytes(row.after).padStart(9) : '        -'}  ${row.width ?? '-'}×${row.height ?? '-'}  ${titles.get(row.path.split('/')[1]) ?? ''}`,
    ),
  })

  const changed = results.filter(row => row.status === 'optimized' || row.status === 'would_optimize')
  const before = changed.reduce((sum, row) => sum + row.size, 0)
  const after = changed.reduce((sum, row) => sum + row.after, 0)
  const errors = results.filter(row => row.status.startsWith('error'))
  console.log(`\n${changed.length} fotos ${apply ? 'optimizadas' : 'se optimizarían'}: ${formatBytes(before)} → ${formatBytes(after)} (−${before ? Math.round((1 - after / before) * 100) : 0} %).`)
  if (errors.length) console.log(`${errors.length} con error (no se tocaron). Revisa el informe.`)

  await mkdir(LOCAL, { recursive: true })
  const report = join(LOCAL, `media-optimizer-${apply ? 'apply' : 'dry-run'}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)
  await writeFile(report, ['estado,empresa_item,ruta,antes_bytes,despues_bytes,ancho,alto',
    ...results.map(row => [row.status, titles.get(row.path.split('/')[1]), row.path, row.size, row.after, row.width, row.height].map(csvCell).join(','))].join('\n'))
  console.log(`Informe: ${relative(ROOT, report).split(sep).join('/')}`)
  if (apply) console.log('Originales guardados en database/local/media-backup/ (para deshacer: --restore).')
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1) })
