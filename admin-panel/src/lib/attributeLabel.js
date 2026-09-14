/**
 * Algunas empresas guardan el label de sus attribute_definitions como JSON
 * multi-idioma (ej. {"es":"Año","en":"Year"}), para que la web pública que
 * consume estos datos pueda ser bilingüe. En el panel de admin solo se
 * gestiona en español, así que aquí se muestra únicamente ese valor en vez
 * del JSON en crudo — que si no, se ve tal cual en el detalle del item.
 *
 * Si el label no tiene ese formato (el caso normal, un texto plano), se
 * devuelve sin tocar.
 */
export function displayLabel(label) {
  if (typeof label !== 'string') return label

  const trimmed = label.trim()
  if (!trimmed.startsWith('{')) return label

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && typeof parsed.es === 'string') {
      return parsed.es
    }
  } catch {
    // No era JSON válido — se muestra el texto original tal cual
  }

  return label
}
