/** A database URL is editable input, never authority for privileged deletion. */
export function ownedItemMediaPath(value: unknown, supabaseUrl: string, companyId: string, itemId: string): string | null {
  if (typeof value !== 'string' || !companyId || !itemId) return null
  try {
    const url = new URL(value)
    const project = new URL(supabaseUrl)
    if (url.origin !== project.origin || url.username || url.password) return null
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/items-media\/(.+)$/)
    if (!match) return null
    const path = decodeURIComponent(match[1])
    const parts = path.split('/')
    // Uploads use company/item/filename. Reject ambiguous or nested paths,
    // double encoding and separators that a downstream URL parser may normalize.
    if (parts.length !== 3 || parts[0] !== companyId || parts[1] !== itemId) return null
    if (parts.some(part => !part || part === '.' || part === '..' || /[\\%\u0000-\u001f\u007f?#]/.test(part))) return null
    return path
  } catch {
    return null
  }
}
