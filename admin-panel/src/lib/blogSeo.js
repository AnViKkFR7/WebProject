// SEO automático del blog. Se calcula al guardar a partir del contenido, sin
// IA ni servicios externos, siguiendo pautas estándar de buscadores:
// título de 30–60 caracteres, descripción de 120–155, URL corta y legible,
// imagen para compartir y textos alternativos en todas las imágenes.
//
// Regla clave: lo que la persona escribe a mano NUNCA se pisa. Un campo se
// (re)genera solo si está vacío o si sigue siendo el valor automático del
// último guardado (es decir, nadie lo ha tocado). Así, si cambias el título,
// el SEO automático se actualiza; si lo personalizaste, se respeta.
import { slugify } from './contentSeo'
import { countWords, markdownHeadings, markdownToText } from './blogMarkdown'

export const BLOG_SEO = Object.freeze({
  titleMin: 30, titleMax: 60, descriptionMin: 120, descriptionMax: 155,
  slugMax: 60, minWords: 300, maxImages: 3,
})

// Palabras que no aportan en una URL ("guia-para-elegir-la-cocina" → "guia-elegir-cocina").
const SLUG_STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'un', 'una', 'unos', 'unas', 'para', 'por', 'con', 'al', 'a', 'que', 'su', 'sus', 'lo', 'the', 'of', 'and', 'to', 'in', 'for', 'an', 'on', 'with'])

const clean = value => String(value || '').replace(/\s+/g, ' ').trim()

function cutAtWord(text, max, ellipsis = true) {
  if (text.length <= max) return text
  const room = ellipsis ? max - 1 : max
  const cut = text.slice(0, room + 1).replace(/\s+\S*$/, '').replace(/[\s,;:.–—-]+$/, '')
  return `${cut || text.slice(0, room)}${ellipsis ? '…' : ''}`
}

export function seoSlug(title) {
  const words = slugify(title).split('-').filter(Boolean)
  const meaningful = words.filter(word => !SLUG_STOPWORDS.has(word))
  const chosen = meaningful.length >= 2 ? meaningful : words
  let slug = ''
  for (const word of chosen) {
    const next = slug ? `${slug}-${word}` : word
    if (next.length > BLOG_SEO.slugMax) break
    slug = next
  }
  return slug || slugify(title).slice(0, BLOG_SEO.slugMax).replace(/-+$/, '')
}

export function seoTitle(title, companyName) {
  const base = clean(title)
  if (!base) return ''
  const brand = clean(companyName)
  // La marca solo se añade si cabe entera: un título cortado rinde peor.
  if (brand && base.length < BLOG_SEO.titleMax && `${base} | ${brand}`.length <= BLOG_SEO.titleMax
    && !base.toLocaleLowerCase().includes(brand.toLocaleLowerCase())) return `${base} | ${brand}`
  return cutAtWord(base, BLOG_SEO.titleMax)
}

export function seoDescription({ intro, heading, body }) {
  const bodyText = clean(markdownToText(body))
  let text = clean(intro) || clean(heading)
  // Una descripción corta desaprovecha el espacio del resultado de búsqueda.
  if (text.length < BLOG_SEO.descriptionMin && bodyText && !bodyText.startsWith(text)) {
    text = clean(`${text}${text && !/[.!?…]$/.test(text) ? '.' : ''} ${bodyText}`)
  } else if (!text) text = bodyText
  return cutAtWord(text, BLOG_SEO.descriptionMax)
}

export const coverOf = images => images.find(image => image.is_cover_image) || images[0] || null

/** Valores automáticos para un contenido dado. */
export function autoSeo({ title, heading, intro, body, images = [], companyName }) {
  return {
    slug: seoSlug(title),
    seo_title: seoTitle(title, companyName),
    seo_description: seoDescription({ intro, heading, body }),
    seo_og_image_url: coverOf(images)?.url_externa || '',
  }
}

function uniqueSlug(slug, takenSlugs) {
  const taken = new Set([...takenSlugs].map(value => String(value).toLowerCase()))
  if (!taken.has(slug)) return slug
  for (let n = 2; ; n++) {
    const candidate = `${slug.slice(0, BLOG_SEO.slugMax - String(n).length - 1).replace(/-+$/, '')}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * Devuelve los campos SEO que se guardarán.
 * - previous: contenido tal como estaba guardado (null si es nuevo).
 * - takenSlugs: slugs de OTROS artículos de la empresa.
 * - keepSlug: true si el artículo ya se publicó: cambiar su URL rompería
 *   enlaces y posicionamiento, así que solo cambia si la persona lo edita.
 */
export function applyAutoSeo({ form, images = [], previous = null, previousImages = [], companyName, takenSlugs = [], keepSlug = false }) {
  const next = autoSeo({ ...form, images, companyName })
  const before = previous ? autoSeo({ ...previous, images: previousImages, companyName }) : {}
  const pick = key => {
    const current = clean(form[key])
    return !current || current === before[key] ? next[key] : current
  }
  const currentSlug = slugify(form.slug)
  const slug = keepSlug && currentSlug ? currentSlug : (pick('slug') && slugify(pick('slug')))
  return {
    slug: slug ? uniqueSlug(slug, takenSlugs) : '',
    seo_title: pick('seo_title'),
    seo_description: pick('seo_description'),
    seo_og_image_url: pick('seo_og_image_url'),
  }
}

/** Texto alternativo por defecto para imágenes sin describir. */
export function autoAltTexts(images, title) {
  const base = clean(title)
  return images.map((image, index) => clean(image.alt_text) || !base ? image : {
    ...image,
    alt_text: image.is_cover_image || images.length === 1 ? base : `${base} (imagen ${index + 1})`,
  })
}

/** Revisión SEO que se muestra en el editor. */
export function seoChecklist({ seo, form, images }) {
  const words = countWords(markdownToText(form.body))
  const headings = markdownHeadings(form.body)
  const title = clean(seo.seo_title)
  const description = clean(seo.seo_description)
  return [
    { key: 'title', ok: title.length >= BLOG_SEO.titleMin && title.length <= BLOG_SEO.titleMax, value: title.length },
    { key: 'description', ok: description.length >= BLOG_SEO.descriptionMin - 40 && description.length <= BLOG_SEO.descriptionMax + 5, value: description.length },
    { key: 'slug', ok: Boolean(seo.slug) && seo.slug.length <= BLOG_SEO.slugMax, value: seo.slug },
    { key: 'images', ok: images.length >= 1, value: images.length },
    { key: 'alt', ok: images.length > 0 && images.every(image => clean(image.alt_text)), value: images.filter(image => clean(image.alt_text)).length },
    { key: 'words', ok: words >= BLOG_SEO.minWords, value: words },
    { key: 'headings', ok: headings.length > 0, value: headings.length },
    { key: 'intro', ok: Boolean(clean(form.intro)), value: clean(form.intro).length },
  ]
}
