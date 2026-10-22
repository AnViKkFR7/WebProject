/**
 * Adjuntos de tareas y facturas.
 *
 * Antes, al editar y subir un archivo nuevo, se sustituía el array entero:
 * los adjuntos anteriores desaparecían sin avisar. Ahora los existentes se
 * conservan y los nuevos se añaden; quitar uno es explícito.
 */

const keyOf = (file) => file?.path || file?.url || file?.name

/** Une los que ya estaban (menos los quitados) con los recién subidos, sin duplicados */
export function mergeAttachments(existing = [], uploaded = []) {
  const result = []
  const seen = new Set()
  for (const file of [...existing, ...uploaded]) {
    if (!file) continue
    const key = keyOf(file)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    result.push(file)
  }
  return result
}

/** Quita un adjunto por su posición */
export function removeAttachment(files = [], index) {
  return files.filter((_, i) => i !== index)
}

/** Rutas de storage que han dejado de estar referenciadas (para borrarlas del bucket) */
export function orphanPaths(before = [], after = []) {
  const kept = new Set(after.map(keyOf))
  return before.filter((file) => file?.path && !kept.has(keyOf(file))).map((file) => file.path)
}

/** Recupera una ruta de Storage propia; nunca abre javascript:, data: ni destinos externos. */
export function plannerAttachmentPath(file, endpoint) {
  if (typeof file?.path === 'string' && file.path) return file.path
  if (typeof file?.url !== 'string' || !endpoint) return null
  try {
    const url = new URL(file.url)
    if (url.origin !== new URL(endpoint).origin || url.protocol !== 'https:') return null
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/media-planner\/(.+)$/)
    return match ? decodeURIComponent(match[1]) : null
  } catch { return null }
}
