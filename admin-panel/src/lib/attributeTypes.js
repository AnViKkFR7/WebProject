// Catálogo de tipos de atributo tal y como los ve el usuario.
// "Lista de opciones" no es un data_type propio: es `text` con
// validation_rules.options, que es lo que ya saben pintar Items e ItemDetail.

export const ATTRIBUTE_TYPES = [
  { value: 'text', icon: 'edit' },
  { value: 'longtext', icon: 'file' },
  { value: 'integer', icon: 'analytics' },
  { value: 'decimal', icon: 'analytics' },
  { value: 'boolean', icon: 'check' },
  { value: 'date', icon: 'planning' },
  { value: 'options', icon: 'list' },
  { value: 'text_array', icon: 'items' },
  { value: 'number_array', icon: 'items' },
]

const KNOWN = new Set(ATTRIBUTE_TYPES.map((type) => type.value))

/** Tipo de interfaz de una definición guardada */
export function uiTypeOf(definition) {
  if (!definition) return 'text'
  if (definition.data_type === 'text' && Array.isArray(definition.validation_rules?.options)) return 'options'
  // 'number' es un alias antiguo de decimal
  if (definition.data_type === 'number') return 'decimal'
  return KNOWN.has(definition.data_type) ? definition.data_type : 'text'
}

export const typeMeta = (uiType) => ATTRIBUTE_TYPES.find((type) => type.value === uiType) || ATTRIBUTE_TYPES[0]

/** Columnas data_type / validation_rules a guardar para un tipo de interfaz */
export function storageFieldsFor(uiType, options = []) {
  if (uiType === 'options') {
    const clean = [...new Set(options.map((option) => option.trim()).filter(Boolean))]
    return { data_type: 'text', validation_rules: { options: clean } }
  }
  return { data_type: uiType, validation_rules: null }
}

/** Clave técnica a partir de la etiqueta: "Nº de baños" → "n_de_banos" */
export function keyFromLabel(label) {
  return String(label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Clave que no choca con las existentes del mismo tipo de item */
export function uniqueKey(label, existingKeys = []) {
  const base = keyFromLabel(label) || 'atributo'
  const taken = new Set(existingKeys)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

/**
 * La etiqueta se guarda como texto plano o como JSON {"es","en"} para webs
 * bilingües. El usuario solo ve dos campos.
 */
export function parseLabel(label) {
  if (typeof label !== 'string') return { es: '', en: '' }
  const trimmed = label.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        return { es: String(parsed.es ?? ''), en: String(parsed.en ?? '') }
      }
    } catch {
      // No era JSON: se trata como texto plano
    }
  }
  return { es: label, en: '' }
}

/** Sin inglés se guarda texto plano, para no cambiar lo que ya leen las webs monolingües */
export function serializeLabel({ es, en }) {
  const esClean = (es || '').trim()
  const enClean = (en || '').trim()
  return enClean ? JSON.stringify({ es: esClean, en: enClean }) : esClean
}

/** Orden del formulario: sort_order y, a igualdad (o antes de la migración), fecha de creación */
export function sortDefinitions(definitions) {
  return [...definitions].sort((a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || String(a.created_at || '').localeCompare(String(b.created_at || '')))
}

/** Mueve un elemento y devuelve la lista con sort_order consecutivo */
export function moveDefinition(definitions, fromIndex, toIndex) {
  if (fromIndex === toIndex || toIndex < 0 || toIndex >= definitions.length) return definitions
  const next = [...definitions]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next.map((definition, index) => ({ ...definition, sort_order: index }))
}

/** El item_type se guarda como "<nombre>_<empresa>"; en pantalla basta el nombre */
export function displayItemType(itemType, companyName) {
  const suffix = companyName ? `_${companyName.trim()}` : ''
  return suffix && itemType?.endsWith(suffix) ? itemType.slice(0, -suffix.length) : itemType
}
