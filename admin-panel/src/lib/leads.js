// Bandeja de solicitudes: estados y utilidades de presentación.

export const LEAD_STATUSES = ['new', 'contacted', 'closed']

/** Al abrir una solicitud nueva se marca como contactada; cerrada es el final */
export const NEXT_STATUS = { new: 'contacted', contacted: 'closed', closed: null }

/** Cuenta por estado, con los tres siempre presentes y el total */
export function countByStatus(leads) {
  const counts = Object.fromEntries(LEAD_STATUSES.map((status) => [status, 0]))
  for (const lead of leads || []) {
    if (counts[lead?.status] !== undefined) counts[lead.status] += 1
  }
  return { ...counts, total: (leads || []).length }
}

/** Filtra por estado y por texto (nombre, email, teléfono o mensaje) */
export function filterLeads(leads, { status = 'all', query = '' } = {}) {
  const needle = query.trim().toLowerCase()
  return (leads || []).filter((lead) => {
    if (status !== 'all' && lead.status !== status) return false
    if (!needle) return true
    return ['name', 'email', 'phone', 'message'].some((field) =>
      String(lead[field] || '').toLowerCase().includes(needle))
  })
}

/** Cuánto hace que entró, en palabras cortas */
export function ageLabel(createdAt, t, now = new Date()) {
  const created = new Date(createdAt)
  if (isNaN(created.getTime())) return ''
  const minutes = Math.floor((now - created) / 60000)
  if (minutes < 1) return t('leads.ageNow')
  if (minutes < 60) return t('leads.ageMinutes').replace('{n}', minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('leads.ageHours').replace('{n}', hours)
  const days = Math.floor(hours / 24)
  return t('leads.ageDays').replace('{n}', days)
}

/** Una solicitud sin responder desde hace más de 2 días pide atención */
export const isStale = (lead, now = new Date()) =>
  lead?.status === 'new' && (now - new Date(lead.created_at)) > 2 * 24 * 60 * 60 * 1000
