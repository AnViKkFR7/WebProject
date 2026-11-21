import { describe, expect, it } from 'vitest'
import { applyAutoSeo, autoAltTexts, seoChecklist, seoDescription, seoSlug, seoTitle } from './blogSeo'

const longBody = `## Primer apartado\n\n${'Texto útil sobre reformas de cocina. '.repeat(60)}`

describe('blogSeo — generación', () => {
  it('crea URLs cortas sin palabras vacías', () => {
    expect(seoSlug('Guía para elegir la encimera de la cocina')).toBe('guia-elegir-encimera-cocina')
    expect(seoSlug('En la casa')).toBe('en-la-casa')
    expect(seoSlug('a'.repeat(30) + ' ' + 'b'.repeat(30) + ' c').length).toBeLessThanOrEqual(60)
  })

  it('añade la marca al título solo si cabe entera', () => {
    expect(seoTitle('Reformar una cocina pequeña', 'Arquelia')).toBe('Reformar una cocina pequeña | Arquelia')
    expect(seoTitle('Arquelia reforma tu cocina', 'Arquelia')).toBe('Arquelia reforma tu cocina')
    const long = seoTitle('Todo lo que necesitas saber antes de reformar una cocina pequeña en casa', 'Arquelia')
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long.endsWith('…')).toBe(true)
  })

  it('completa una descripción corta con el cuerpo y la corta en una palabra', () => {
    const description = seoDescription({ intro: 'Ideas para tu cocina', body: longBody })
    expect(description.startsWith('Ideas para tu cocina. Primer apartado')).toBe(true)
    expect(description.length).toBeLessThanOrEqual(155)
    expect(description).not.toMatch(/\s…$/)
  })
})

describe('blogSeo — al guardar', () => {
  const form = { title: 'Cómo reformar una cocina pequeña', intro: 'Consejos prácticos.', body: longBody, slug: '', seo_title: '', seo_description: '', seo_og_image_url: '' }
  const images = [{ url_externa: 'https://x.supabase.co/a.webp', is_cover_image: true }]

  it('rellena todo lo vacío, con la portada como imagen para compartir', () => {
    const seo = applyAutoSeo({ form, images, companyName: 'Arquelia' })
    expect(seo).toMatchObject({ slug: 'como-reformar-cocina-pequena', seo_title: 'Cómo reformar una cocina pequeña | Arquelia', seo_og_image_url: images[0].url_externa })
    expect(seo.seo_description.length).toBeGreaterThan(100)
  })

  it('nunca pisa lo que se escribió a mano', () => {
    const custom = { ...form, slug: 'mi-url', seo_title: 'Mi título', seo_description: 'Mi descripción', seo_og_image_url: 'https://otra.es/i.jpg' }
    expect(applyAutoSeo({ form: custom, images, companyName: 'Arquelia' })).toEqual({ slug: 'mi-url', seo_title: 'Mi título', seo_description: 'Mi descripción', seo_og_image_url: 'https://otra.es/i.jpg' })
  })

  it('actualiza el SEO automático si cambia el título y nadie lo había tocado', () => {
    const previous = { ...form, ...applyAutoSeo({ form, images, companyName: 'Arquelia' }) }
    const edited = { ...previous, title: 'Cocinas abiertas al salón' }
    const seo = applyAutoSeo({ form: edited, previous, images, previousImages: images, companyName: 'Arquelia' })
    expect(seo.seo_title).toBe('Cocinas abiertas al salón | Arquelia')
    expect(seo.slug).toBe('cocinas-abiertas-salon')
  })

  it('no cambia la URL de un artículo ya publicado', () => {
    const previous = { ...form, ...applyAutoSeo({ form, images, companyName: 'Arquelia' }) }
    const seo = applyAutoSeo({ form: { ...previous, title: 'Otro título' }, previous, images, previousImages: images, companyName: 'Arquelia', keepSlug: true })
    expect(seo.slug).toBe(previous.slug)
  })

  it('evita slugs repetidos en la empresa', () => {
    expect(applyAutoSeo({ form, images, takenSlugs: ['como-reformar-cocina-pequena', 'como-reformar-cocina-pequena-2'] }).slug).toBe('como-reformar-cocina-pequena-3')
  })

  it('pone texto alternativo a las imágenes sin describir', () => {
    expect(autoAltTexts([{ is_cover_image: true, alt_text: '' }, { alt_text: 'Detalle' }, { alt_text: ' ' }], 'Cocina').map(image => image.alt_text))
      .toEqual(['Cocina', 'Detalle', 'Cocina (imagen 3)'])
  })

  it('la revisión marca lo que falta', () => {
    const checks = Object.fromEntries(seoChecklist({ seo: { slug: 'a', seo_title: 'corto', seo_description: '' }, form: { body: 'Pocas palabras', intro: '' }, images: [] }).map(check => [check.key, check.ok]))
    expect(checks).toEqual({ title: false, description: false, slug: true, images: false, alt: false, words: false, headings: false, intro: false })
    const good = Object.fromEntries(seoChecklist({ seo: applyAutoSeo({ form, images, companyName: 'Arquelia' }), form, images: [{ ...images[0], alt_text: 'Cocina' }] }).map(check => [check.key, check.ok]))
    expect(Object.values(good).every(Boolean)).toBe(true)
  })
})
