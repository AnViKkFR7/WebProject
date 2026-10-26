import { describe, expect, it } from 'vitest'
import { buildSeoPreview, SEO_LIMITS, slugify } from './contentSeo'

describe('content SEO helpers', () => {
  it('creates a stable URL-safe slug from Spanish titles', () => {
    expect(slugify('Café & Jardín: Ñandú')).toBe('cafe-y-jardin-nandu')
    expect(slugify('  ')).toBe('')
    expect(slugify('x'.repeat(200))).toHaveLength(SEO_LIMITS.slug)
  })

  it('falls back to the public title and summary for search preview', () => {
    expect(buildSeoPreview({ title: 'Piso céntrico', summary: 'Luminoso', slug: 'piso-centrico' }))
      .toEqual({ title: 'Piso céntrico', description: 'Luminoso', url: 'https://tu-dominio/items/piso-centrico' })
  })

  it('uses explicit SEO values and a post URL when present', () => {
    expect(buildSeoPreview({
      title: 'Título', summary: 'Resumen', seoTitle: 'SEO', seoDescription: 'Meta', slug: 'historia', section: 'blog',
    })).toEqual({ title: 'SEO', description: 'Meta', url: 'https://tu-dominio/blog/historia' })
  })
})
