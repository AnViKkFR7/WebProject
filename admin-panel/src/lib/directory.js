// Directorio de clientes y colaboradores: filtros y conversión ficha → formulario.
// Las fichas anteriores a CLIENT_DIRECTORY_RELATIONSHIPS.sql no traen los campos nuevos:
// se tratan como «cliente / empresa», igual que hace la migración.

export const RELATION_FILTERS = ['all', 'clients', 'collaborators']
export const FORM_FILTERS = ['any', 'company', 'individual']

export const emptyPartyForm = {
  name: '', tax_id: '', billing_address: '', phone: '', email: '', responsible: '', color: '#1976d2',
  legal_form: 'company', is_client: true, is_collaborator: false, collaborator_role: '', notes: '',
}

const isClient = party => party.is_client !== false
const isCollaborator = party => party.is_collaborator === true
const legalFormOf = party => (party.legal_form === 'individual' ? 'individual' : 'company')

const normalize = value => String(value || '')
  .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const compactTaxId = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase()

export function filterDirectory(parties, { search = '', relation = 'all', legalForm = 'any' } = {}) {
  const query = normalize(search)
  const taxQuery = compactTaxId(search)
  return parties.filter(party => {
    if (relation === 'clients' && !isClient(party)) return false
    if (relation === 'collaborators' && !isCollaborator(party)) return false
    if (legalForm !== 'any' && legalFormOf(party) !== legalForm) return false
    if (!query) return true
    return [party.name, party.collaborator_role, party.responsible, party.email].some(value => normalize(value).includes(query))
      || (taxQuery.length >= 3 && compactTaxId(party.tax_id).includes(taxQuery))
  })
}

export function partyToForm(party) {
  return {
    name: party.name || '',
    tax_id: party.tax_id || '',
    billing_address: party.billing_address || '',
    phone: party.phone || '',
    email: party.email || '',
    responsible: party.responsible || '',
    color: party.color || '#1976d2',
    legal_form: legalFormOf(party),
    is_client: isClient(party),
    is_collaborator: isCollaborator(party),
    collaborator_role: party.collaborator_role || '',
    notes: party.notes || '',
  }
}

/** Últimos 12 meses (incluido el actual) con importe 0 donde no hubo facturas. */
export function lastTwelveMonths(monthly = [], today = new Date()) {
  const totals = new Map(monthly.map(row => [row.month, Number(row.total) || 0]))
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11 + index, 1))
    const month = date.toISOString().slice(0, 7)
    return { month, total: totals.get(month) || 0 }
  })
}
