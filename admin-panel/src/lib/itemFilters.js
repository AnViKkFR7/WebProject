// Lógica pura de los filtros de Items: qué columna de attribute_values
// corresponde a cada tipo de dato, cómo se castean los valores, y cómo se
// leen/escriben los filtros en la URL. Sin React ni Supabase, para poder
// probarla aislada.

// El formulario de atributos crea integer/decimal/longtext, pero el filtro
// antiguo sólo conocía 'number' y 'text': con un atributo numérico leía
// value_text (vacío) y nunca encontraba nada.
const VALUE_COLUMN = {
  text: 'value_text',
  longtext: 'value_text',
  integer: 'value_number',
  decimal: 'value_number',
  number: 'value_number',
  boolean: 'value_boolean',
  date: 'value_date',
  text_array: 'value_text_array',
  number_array: 'value_number_array',
}

const NUMERIC_TYPES = new Set(['integer', 'decimal', 'number', 'number_array'])

export function valueColumnFor(dataType) {
  return VALUE_COLUMN[dataType] || 'value_text'
}

export function isArrayType(dataType) {
  return dataType === 'text_array' || dataType === 'number_array'
}

// Los valores del filtro llegan siempre como texto (URL, <select>)
export function castFilterValue(dataType, raw) {
  if (NUMERIC_TYPES.has(dataType)) {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  if (dataType === 'boolean') return raw === true || raw === 'true'
  return String(raw)
}

// Valor de una fila de attribute_values según su tipo (escalar o array)
export function readAttributeValue(row, dataType) {
  return row?.[valueColumnFor(dataType)] ?? null
}

// Valores distintos de un atributo en toda la empresa, como texto ordenado
export function distinctValues(rows, dataType) {
  const values = new Set()
  for (const row of rows) {
    const value = readAttributeValue(row, dataType)
    if (Array.isArray(value)) value.forEach((v) => v != null && values.add(String(v)))
    else if (value !== null && value !== undefined && value !== '') values.add(String(value))
  }
  const list = Array.from(values)
  return NUMERIC_TYPES.has(dataType)
    ? list.sort((a, b) => Number(a) - Number(b))
    : list.sort((a, b) => a.localeCompare(b))
}

// ─── Estado en la URL ────────────────────────────────────────
// Así volver desde un item, el botón "atrás" o compartir el enlace
// conservan exactamente los filtros y la página.

const ATTR_PREFIX = 'a.'

export function readFiltersFromParams(params) {
  const attrs = {}
  for (const [key, value] of params.entries()) {
    if (!key.startsWith(ATTR_PREFIX)) continue
    const defId = key.slice(ATTR_PREFIX.length)
    ;(attrs[defId] ||= []).push(value)
  }
  const page = Number.parseInt(params.get('page') || '1', 10)
  return {
    status: params.getAll('status'),
    itemType: params.getAll('type'),
    sort: params.get('sort') === 'asc' ? 'asc' : null,
    q: params.get('q') || '',
    page: Number.isFinite(page) && page > 0 ? page : 1,
    attrs,
  }
}

export function writeFiltersToParams(filters) {
  const params = new URLSearchParams()
  filters.status?.forEach((v) => params.append('status', v))
  filters.itemType?.forEach((v) => params.append('type', v))
  if (filters.sort === 'asc') params.set('sort', 'asc')
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  for (const [defId, values] of Object.entries(filters.attrs || {})) {
    values?.forEach((v) => params.append(`${ATTR_PREFIX}${defId}`, v))
  }
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

export function hasActiveFilters(filters) {
  return Boolean(
    filters.status.length ||
    filters.itemType.length ||
    filters.sort ||
    filters.q ||
    Object.values(filters.attrs).some((values) => values.length)
  )
}
