// Búsqueda del listado de facturas y presupuestos.
// Mismo criterio que el directorio de clientes y que el resumen de su ficha:
// sin tildes ni mayúsculas, y el NIF/CIF sin espacios, guiones ni puntos
// («B-12.345.678» se encuentra buscando «b12345678» y al revés).
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const compactTaxId = value => String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()

export function matchesBillingSearch(record, search) {
  const query = normalize(search)
  if (!query) return true
  const document = record?.document ?? {}
  const customer = document.customer ?? {}
  const text = [record?.number, customer.name, customer.taxId, ...(document.lines ?? []).map(line => line.description)]
  if (text.some(value => normalize(value).includes(query))) return true
  const taxQuery = compactTaxId(search)
  return taxQuery.length >= 3 && compactTaxId(customer.taxId).includes(taxQuery)
}
