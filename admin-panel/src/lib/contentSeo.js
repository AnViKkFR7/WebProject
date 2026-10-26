export const SEO_LIMITS = Object.freeze({ title: 70, description: 160, slug: 120 })

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SEO_LIMITS.slug)
    .replace(/-+$/g, '')
}

export function buildSeoPreview({ title, summary, seoTitle, seoDescription, slug, section = 'items' }) {
  const path = slugify(slug) || 'tu-contenido'
  return {
    title: String(seoTitle || title || '').trim(),
    description: String(seoDescription || summary || '').trim(),
    url: `https://tu-dominio/${section}/${path}`,
  }
}
