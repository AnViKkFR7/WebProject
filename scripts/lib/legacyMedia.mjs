// Optimización de fotos antiguas de `items-media` (subidas antes de que el
// panel comprimiera al subir). Lógica separada del script para poder probarla
// sin red: recibe el cliente de Storage y el sistema de archivos como
// dependencias.
//
// Principio: la foto se reemplaza EN SU MISMA RUTA y con su MISMO FORMATO.
// Así no cambia ninguna URL (item_media, blog, Open Graph, enlaces ya
// compartidos), no se dispara ningún trigger de la base de datos y la web del
// cliente sigue igual. Antes de tocar nada se guarda el original en local.
import sharp from 'sharp'

export const BUCKET = 'items-media'
export const MAX_SIDE = 1920 // el mismo límite que usa el panel al subir
export const JPEG_QUALITY = 82
// Si el resultado no ahorra al menos un 20 %, no merece la pena tocar la foto.
export const MIN_SAVING_RATIO = 0.8
const OPTIMIZABLE = new Set(['image/jpeg', 'image/png'])

/** Recorre el bucket (empresa/item/archivo) y devuelve solo los archivos. */
export async function listBucketFiles(storage, prefix = '', depth = 0) {
  const files = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`No se pudo listar "${prefix || '/'}": ${error.message}`)
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // Las carpetas vienen sin id ni metadata. Solo hay dos niveles.
      if (entry.id === null) { if (depth < 2) files.push(...await listBucketFiles(storage, path, depth + 1)) }
      else files.push({ path, size: Number(entry.metadata?.size) || 0, mimetype: entry.metadata?.mimetype || '' })
    }
    if (data.length < 1000) return files
  }
}

/** Fotos candidatas: JPG/PNG por encima del umbral, de mayor a menor. */
export function selectCandidates(files, { minBytes, company } = {}) {
  return files
    .filter(file => OPTIMIZABLE.has(file.mimetype) && file.size >= minBytes)
    .filter(file => !company || file.path.startsWith(`${company}/`))
    .sort((a, b) => b.size - a.size)
}

/**
 * Recomprime una foto manteniendo su formato. Endereza según EXIF y luego
 * quita los metadatos (incluida la ubicación GPS de las fotos de móvil): el
 * navegador la muestra exactamente igual.
 */
export async function encode(buffer, mimetype) {
  const image = sharp(buffer, { failOn: 'error' }).rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
  const output = mimetype === 'image/png'
    ? await image.png({ compressionLevel: 9, effort: 10 }).toBuffer({ resolveWithObject: true })
    : await image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer({ resolveWithObject: true })
  return { buffer: output.data, width: output.info.width, height: output.info.height }
}

export const worthIt = (before, after) => after > 0 && after <= before * MIN_SAVING_RATIO

export const formatBytes = bytes => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`

/**
 * Procesa las candidatas una a una. Sin `apply` solo calcula (descarga y
 * comprime en memoria, pero no sube nada). Con `apply`: copia de seguridad →
 * comprobación → subida en la misma ruta. Un fallo en una foto no para el resto.
 */
export async function optimizeFiles(candidates, { storage, apply, backup, log = () => {} }) {
  const results = []
  for (const file of candidates) {
    const row = { ...file, after: null, width: null, height: null, status: '' }
    try {
      const { data, error } = await storage.from(BUCKET).download(file.path)
      if (error || !data) throw new Error(error?.message || 'descarga vacía')
      const original = Buffer.from(await data.arrayBuffer())
      const result = await encode(original, file.mimetype)
      Object.assign(row, { after: result.buffer.length, width: result.width, height: result.height })
      if (!worthIt(original.length, result.buffer.length)) row.status = 'skip_little_gain'
      else if (!apply) row.status = 'would_optimize'
      else {
        // Nunca se sobrescribe una copia ya existente: si el script se repite,
        // la copia sigue siendo la del original de verdad.
        await backup.save(file.path, original, file.mimetype)
        const { error: uploadError } = await storage.from(BUCKET)
          .upload(file.path, result.buffer, { contentType: file.mimetype, upsert: true })
        if (uploadError) throw new Error(uploadError.message)
        row.status = 'optimized'
      }
    } catch (error) {
      row.status = `error: ${error instanceof Error ? error.message : String(error)}`
    }
    results.push(row)
    log(row)
  }
  return results
}

/** Vuelve a subir los originales guardados (deshacer). */
export async function restoreFiles(entries, { storage, log = () => {} }) {
  const results = []
  for (const { path, buffer, contentType } of entries) {
    const { error } = await storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true })
    const row = { path, status: error ? `error: ${error.message}` : 'restored' }
    results.push(row)
    log(row)
  }
  return results
}
