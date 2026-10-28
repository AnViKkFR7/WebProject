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

function trimAtWord(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  const shortened = text.slice(0, limit).replace(/\s+\S*$/, '').trim()
  return `${shortened || text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

/** Creates local, deterministic suggestions. Existing non-empty SEO fields are never replaced. */
export function suggestItemSeo({ title, summary, values = {} }) {
  const contentTitle = String(title || '').replace(/\s+/g, ' ').trim()
  const contentSummary = String(summary || '').replace(/\s+/g, ' ').trim()
  const suggestion = {}
  const generatedSlug = !String(values.slug || '').trim() && contentTitle ? slugify(contentTitle) : ''
  if (generatedSlug) suggestion.slug = generatedSlug
  if (!String(values.seo_title || '').trim() && contentTitle) suggestion.seo_title = trimAtWord(contentTitle, SEO_LIMITS.title)
  if (!String(values.seo_description || '').trim() && (contentSummary || contentTitle)) {
    const description = contentSummary || `Información y detalles de ${contentTitle}.`
    suggestion.seo_description = trimAtWord(description, SEO_LIMITS.description)
  }
  return suggestion
}

export function buildSeoPreview({ title, summary, seoTitle, seoDescription, slug, section = 'items' }) {
  const path = slugify(slug) || 'tu-contenido'
  return {
    title: String(seoTitle || title || '').trim(),
    description: String(seoDescription || summary || '').trim(),
    url: `https://tu-dominio/${section}/${path}`,
  }
}
