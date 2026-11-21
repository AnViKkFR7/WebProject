import { describe, expect, it } from 'vitest'
import { countWords, docToMarkdown, markdownToHtml, markdownToText, safeHref } from './blogMarkdown'

const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const p = (...content) => ({ type: 'paragraph', content })
const doc = (...content) => ({ type: 'doc', content })

describe('blogMarkdown — editor → Markdown', () => {
  it('serializa encabezados, marcas, enlaces, listas, citas y separador', () => {
    const markdown = docToMarkdown(doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Cómo elegir')] },
      p(text('Texto '), text('negrita', [{ type: 'bold' }]), text(' y '), text('cursiva', [{ type: 'italic' }]), text('.')),
      p(text('Visita '), text('la web', [{ type: 'link', attrs: { href: 'https://ejemplo.es/a b' } }])),
      { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('uno'))] }, { type: 'listItem', content: [p(text('dos'))] }] },
      { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [p(text('primero'))] }] },
      { type: 'blockquote', content: [p(text('cita'))] },
      { type: 'horizontalRule' },
      { type: 'heading', attrs: { level: 3 }, content: [text('Detalle')] },
    ))
    expect(markdown).toBe([
      '## Cómo elegir',
      'Texto **negrita** y *cursiva*.',
      'Visita [la web](https://ejemplo.es/a%20b)',
      '- uno\n- dos',
      '1. primero',
      '> cita',
      '---',
      '### Detalle',
    ].join('\n\n'))
  })

  it('saca los espacios fuera de las marcas (si no, no sería negrita)', () => {
    expect(docToMarkdown(doc(p(text('a'), text(' fuerte ', [{ type: 'bold' }]), text('b'))))).toBe('a **fuerte** b')
  })

  it('conserva los párrafos vacíos como espaciado, pero no al principio ni al final', () => {
    const markdown = docToMarkdown(doc(p(), p(text('uno')), p(), p(), p(text('dos')), p()))
    expect(markdown).toBe('uno\n\n&nbsp;\n\n&nbsp;\n\ndos')
    expect(markdownToHtml(markdown)).toContain('<p>&nbsp;</p>')
  })

  it('escapa el texto que Markdown interpretaría como formato', () => {
    const markdown = docToMarkdown(doc(p(text('# no es título')), p(text('2. no es lista')), p(text('a*b_c [x] <script>'))))
    expect(markdown).toBe('\\# no es título\n\n2\\. no es lista\n\na\\*b\\_c \\[x\\] \\<script\\>')
    expect(markdownToText(markdown)).toBe('# no es título\n2. no es lista\na*b_c [x] <script>')
  })

  it('descarta enlaces peligrosos y convierte saltos de línea', () => {
    expect(docToMarkdown(doc(p(text('mal', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]), { type: 'hardBreak' }, text('fin'))))).toBe('mal\\\nfin')
    expect(safeHref('mailto:a@b.es')).toBe('mailto:a@b.es')
    expect(safeHref('data:text/html,x')).toBe('')
  })

  it('anida listas con la sangría correcta', () => {
    const nested = { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('padre')), { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('hijo'))] }] }] }] }
    expect(docToMarkdown(doc(nested))).toBe('- padre\n  - hijo')
    expect(markdownToHtml('- padre\n  - hijo').replace(/\n/g, '')).toBe('<ul><li>padre<ul><li>hijo</li></ul></li></ul>')
  })
})

describe('blogMarkdown — Markdown → editor', () => {
  it('muestra el HTML escrito a mano como texto, nunca lo ejecuta', () => {
    const html = markdownToHtml('Hola <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>')
    expect(html).not.toMatch(/<img|<script/)
    expect(html).toContain('&lt;script&gt;')
  })

  it('elimina enlaces javascript: e imágenes Markdown', () => {
    const html = markdownToHtml('[x](javascript:alert(1)) ![foto](https://a.es/f.jpg)')
    expect(html).not.toContain('href="javascript')
    expect(html).not.toContain('<img')
  })

  it('ida y vuelta conserva el contenido existente escrito en Markdown', () => {
    const original = '## Título\n\nPárrafo con **negrita** y [enlace](https://a.es).\n\n- a\n- b'
    expect(markdownToHtml(original)).toContain('<h2>Título</h2>')
    expect(markdownToHtml(original)).toContain('<strong>negrita</strong>')
    expect(markdownToHtml(original)).toContain('<a href="https://a.es">enlace</a>')
  })

  it('cuenta palabras del texto plano', () => {
    expect(countWords(markdownToText('## Hola\n\nDos **palabras** más, ¿vale?'))).toBe(5)
  })
})
