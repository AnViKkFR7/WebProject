export type WeeklySummaryPayload = {
  week_start: string
  week_end: string
  recipient_emails: string[]
  new_leads: number
  new_contacts: number
  overdue_followups: number
  issued_invoices: number
  overdue_invoices: number
  quotes_waiting: number
  upcoming_planning: number
  page_views: number
}

const count = (value: number) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character] || character)

export function splitWeeklySummaryRecipients(value: unknown) {
  const emails = Array.isArray(value) ? value.filter((email): email is string => typeof email==='string' && email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) : []
  const unique = [...new Map(emails.map(email => [email.toLocaleLowerCase(),email])).values()]
  return { to:unique[0] || null,bcc:unique.slice(1) }
}

export function buildWeeklySummaryEmail(payload: WeeklySummaryPayload) {
  if (![payload.week_start,payload.week_end].every(value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error('Invalid week range')
  const start = new Date(`${payload.week_start}T12:00:00Z`)
  const end = new Date(`${payload.week_end}T12:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.toISOString().slice(0,10)!==payload.week_start || end.toISOString().slice(0,10)!==payload.week_end || end < start) throw new Error('Invalid week range')
  const period = new Intl.DateTimeFormat('es-ES', { day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Madrid' })
  const range = `${period.format(start)} – ${period.format(end)}`
  const metrics: Array<[string, number]> = [
    ['Solicitudes recibidas', count(payload.new_leads)],
    ['Contactos creados', count(payload.new_contacts)],
    ['Seguimientos vencidos', count(payload.overdue_followups)],
    ['Facturas emitidas', count(payload.issued_invoices)],
    ['Facturas vencidas', count(payload.overdue_invoices)],
    ['Presupuestos pendientes de respuesta', count(payload.quotes_waiting)],
    ['Tareas de la semana siguiente', count(payload.upcoming_planning)],
    ['Páginas vistas', count(payload.page_views)],
  ]
  const text = [`Resumen semanal · ${range}`, '', ...metrics.map(([label, value]) => `${label}: ${value}`), '', 'Este mensaje contiene cifras agregadas, sin datos identificables de clientes ni documentos.', 'Envío automático semanal a las direcciones de administradores activos de la empresa.'].join('\n')
  const rows = metrics.map(([label, value]) => `<tr><th scope="row" style="padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0">${escapeHtml(label)}</th><td style="padding:8px 12px;text-align:right;font-weight:700;border-bottom:1px solid #e2e8f0">${value}</td></tr>`).join('')
  const html = `<main style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#17324f"><h1 style="font-size:22px">Resumen semanal</h1><p style="color:#526579">${escapeHtml(range)}</p><table style="width:100%;border-collapse:collapse">${rows}</table><p style="font-size:12px;color:#63758b;margin-top:20px">Este mensaje contiene cifras agregadas, sin datos identificables de clientes ni documentos.</p><p style="font-size:12px;color:#63758b">Envío automático semanal a las direcciones de administradores activos de la empresa.</p></main>`
  return { subject:`Resumen semanal · ${range}`, text, html }
}
