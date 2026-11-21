// El cuerpo del blog se GUARDA en Markdown (las webs de clientes ya lo pintan
// con react-markdown y skipHtml), pero se EDITA de forma visual. Este módulo
// traduce entre ambos mundos sin depender del editor:
//   markdownToHtml  → para cargar un artículo en el editor
//   docToMarkdown   → para guardar lo que hay en el editor (JSON de Tiptap)
//   markdownToText  → texto plano para SEO y recuento de palabras
// Solo se admite lo que ofrece la barra: H2/H3, negrita, cursiva, enlaces,
// listas, citas, separador, saltos de línea y párrafos vacíos (espaciado).
import { Marked } from 'marked'

// Un párrafo vacío en Markdown desaparece; con &nbsp; se conserva el hueco
// tanto en el editor como en react-markdown (es una entidad, no HTML).
export const EMPTY_PARAGRAPH = '&nbsp;'
const NBSP = ' '

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// Cualquier HTML escrito a mano se muestra como texto: ni el editor ni la web
// lo interpretan. Los enlaces solo pueden ser http(s), mailto o tel.
const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html: ({ text }) => escapeHtml(text),
    image: ({ text }) => escapeHtml(text),
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens)
      return safeHref(href) ? `<a href="${escapeHtml(href)}">${label}</a>` : label
    },
  },
})

export function safeHref(href) {
  const value = String(href || '').trim()
  return /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : ''
}

export const markdownToHtml = markdown => marked.parse(String(markdown || ''), { async: false })

// ---------------------------------------------------------------- serializar

// Escapa lo que Markdown interpretaría como formato dentro de un texto normal.
function escapeText(text) {
  return text.replace(/([\\`*_[\]<>|~])/g, '\\$1')
}

// Al principio de línea, #, >, -, + o "1." convertirían el texto en otro bloque.
function escapeLineStart(text) {
  return text
    .replace(/^(\s*)([#>+-])/, '$1\\$2')
    .replace(/^(\s*\d+)([.)])/, '$1\\$2')
}

const encodeHref = href => href.replace(/\s/g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')

// Las marcas no admiten espacios pegados por dentro ("** hola**" no es negrita):
// los espacios se sacan fuera de los delimitadores.
function wrap(text, open, close = open) {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!match[2]) return text
  return `${match[1]}${open}${match[2]}${close}${match[3]}`
}

function inline(nodes = []) {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') { out += '\\\n'; continue }
    if (node.type !== 'text') continue
    let text = escapeText(node.text.replace(new RegExp(NBSP, 'g'), ' '))
    const marks = node.marks || []
    if (marks.some(mark => mark.type === 'italic')) text = wrap(text, '*')
    if (marks.some(mark => mark.type === 'bold')) text = wrap(text, '**')
    const link = marks.find(mark => mark.type === 'link')
    const href = safeHref(link?.attrs?.href)
    if (href && text.trim()) text = wrap(text, '[', `](${encodeHref(href)})`)
    out += text
  }
  // El editor ya funde los textos contiguos con las mismas marcas.
  return out
}

const isBlankParagraph = node => node.type === 'paragraph'
  && (node.content || []).every(child => child.type === 'text' && !child.text.replace(new RegExp(NBSP, 'g'), '').trim())

function block(node) {
  switch (node.type) {
    case 'paragraph': {
      if (isBlankParagraph(node)) return EMPTY_PARAGRAPH
      return inline(node.content).split('\n').map(escapeLineStart).join('\n')
    }
    case 'heading': {
      const level = Math.min(Math.max(node.attrs?.level || 2, 2), 3)
      const text = inline(node.content).replace(/\\\n/g, ' ').trim()
      return text ? `${'#'.repeat(level)} ${text}` : EMPTY_PARAGRAPH
    }
    case 'bulletList':
    case 'orderedList':
      return (node.content || []).map((item, index) => listItem(item, node.type === 'orderedList' ? `${(node.attrs?.start || 1) + index}.` : '-')).join('\n')
    case 'blockquote':
      return blocks(node.content).split('\n').map(line => (line ? `> ${line}` : '>')).join('\n')
    case 'horizontalRule':
      return '---'
    default:
      return blocks(node.content)
  }
}

function listItem(item, marker) {
  const indent = ' '.repeat(marker.length + 1)
  const parts = (item.content || []).map(child => block(child))
  const [first = '', ...rest] = parts
  const firstLines = first.split('\n')
  const lines = [`${marker} ${firstLines[0]}`, ...firstLines.slice(1).map(line => indent + line)]
  for (const part of rest) lines.push(...part.split('\n').map(line => (line ? indent + line : line)))
  return lines.join('\n')
}

const blocks = (nodes = []) => nodes.map(block).filter(part => part !== '').join('\n\n')

/** JSON del editor → Markdown. Quita los huecos vacíos al principio y al final. */
export function docToMarkdown(doc) {
  const parts = (doc?.content || []).map(block)
  while (parts.length && parts[0] === EMPTY_PARAGRAPH) parts.shift()
  while (parts.length && parts[parts.length - 1] === EMPTY_PARAGRAPH) parts.pop()
  return parts.join('\n\n')
}

// ---------------------------------------------------------------- texto plano

/** Markdown → texto plano (para la descripción SEO y contar palabras). */
export function markdownToText(markdown) {
  return markdownToHtml(markdown)
    .replace(/<\/(p|h[1-6]|li|blockquote)>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity])
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

/** Encabezados H2/H3 del artículo, para la revisión SEO. */
export function markdownHeadings(markdown) {
  return [...String(markdown || '').matchAll(/^(#{1,6})\s+(.+)$/gm)].map(match => ({ level: match[1].length, text: match[2].trim() }))
}

export const countWords = text => (String(text || '').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length
