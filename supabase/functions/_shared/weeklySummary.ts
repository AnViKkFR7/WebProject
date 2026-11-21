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

export function buildWeeklySummaryEmail(payload: WeeklySummaryPayload, options: { isTest?: boolean; adminAppUrl?: string } = {}) {
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
  let panelUrl = 'https://admin.moiraordo.es/'
  if (options.adminAppUrl) {
    try {
      const configured = new URL(options.adminAppUrl)
      if (configured.protocol === 'https:' && !configured.username && !configured.password) panelUrl = `${configured.origin}/`
    } catch { /* Keep the public panel URL when configuration is invalid. */ }
  }
  const heading = options.isTest ? 'Prueba del resumen semanal' : 'Resumen semanal'
  const testNote = options.isTest ? 'PRUEBA: este correo se envía únicamente a administradores activos de WatchEcommerceDemo para validar la entrega.' : ''
  const notice = options.isTest ? 'Este es un envío manual de prueba, no el resumen automático.' : 'Envío automático semanal a las direcciones de administradores activos de la empresa.'
  const issuanceNote = 'Las emisiones se cuentan una sola vez. Los históricos sin fecha de emisión verificable quedan fuera.'
  const recurrenceNote = 'Cada repetición de una tarea recurrente cuenta como una ocurrencia.'
  const text = [heading + ` · ${range}`, ...(testNote ? [testNote] : []), '', ...metrics.map(([label, value]) => `${label}: ${value}`), '', issuanceNote, recurrenceNote, '', `Abrir el panel: ${panelUrl}`, '', 'Este mensaje contiene cifras agregadas, sin datos identificables de clientes ni documentos.', notice, 'MoiraOrdo · https://www.moiraordo.es'].join('\n')
  const number = (value: number) => new Intl.NumberFormat('es-ES').format(count(value))
  const labelStyle = 'margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#585b6a;'
  const eyebrow = 'margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;line-height:16px;letter-spacing:1.7px;text-transform:uppercase;color:#1f63cc;'
  const attention = metrics[2][1] + metrics[4][1] + metrics[5][1]
  const attentionRow = (label: string, value: number, last = false) => `<tr><th scope="row" style="padding:15px 0;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;font-weight:400;color:#252a3c;${last ? '' : 'border-bottom:1px solid #d6e3f5;'}">${escapeHtml(label)}</th><td width="84" align="right" style="padding:15px 0 15px 12px;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;font-weight:700;color:${value > 0 ? '#1f63cc' : '#585b6a'};${last ? '' : 'border-bottom:1px solid #d6e3f5;'}overflow-wrap:anywhere;">${number(value)}</td></tr>`
  const activityCell = (label: string, value: number) => `<td width="50%" valign="top" class="metric-cell" style="padding:20px 18px;border:1px solid #e5e5e8;background-color:#ffffff;overflow-wrap:anywhere;"><p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:${number(value).length > 10 ? 24 : 36}px;line-height:1.2;letter-spacing:-1px;color:#00051e;">${number(value)}</p><p style="${labelStyle}">${escapeHtml(label)}</p></td>`
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(heading)}</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}table{border-collapse:collapse}p{overflow-wrap:anywhere;word-wrap:break-word}a:focus-visible{outline:2px solid #4692ff;outline-offset:4px}@media screen and (max-width:640px){.outer-pad{padding:16px 10px!important}.side-pad{padding-left:24px!important;padding-right:24px!important}.hero-title{font-size:36px!important;line-height:40px!important}.metric-cell{padding:18px 14px!important}.panel-button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background-color:#efefed;color:#00051e;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Tu actividad, lo que requiere atención y la semana que viene. ${escapeHtml(range)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#efefed"><tr><td class="outer-pad" align="center" style="padding:40px 20px;">
<!--[if mso]><table role="presentation" width="640" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;table-layout:fixed;">
<tr><td class="side-pad" bgcolor="#00051e" style="padding:28px 40px;border-radius:18px 18px 0 0;background-color:#00051e;"><a href="https://www.moiraordo.es" style="font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:40px;letter-spacing:-1.5px;color:#fcfbf7;text-decoration:none;">moira<span style="color:#82daff;">ordo</span></a><p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:16px;letter-spacing:1.6px;text-transform:uppercase;color:#c7ccda;">Tu negocio, con perspectiva</p></td></tr>
${options.isTest ? '<tr><td class="side-pad" bgcolor="#e9f2ff" style="padding:12px 40px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;font-weight:700;color:#1f63cc;">PRUEBA DE ENTREGA · WatchEcommerceDemo</td></tr>' : ''}
<tr><td class="side-pad" bgcolor="#fcfbf7" style="padding:36px 40px 30px;"><p style="${eyebrow}">Tu informe semanal</p><h1 class="hero-title" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:48px;line-height:52px;letter-spacing:-1.8px;font-weight:400;color:#00051e;">Tu semana,<br>en perspectiva<span style="color:#1f63cc;">.</span></h1><p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;font-weight:700;color:#1f63cc;">${escapeHtml(range)}</p><p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#585b6a;">Una pausa para ver qué se ha movido, qué merece tu atención y cómo preparar los próximos días.</p></td></tr>
<tr><td class="side-pad" bgcolor="#ffffff" style="padding:30px 40px 0;border-top:1px solid #e8e8ec;"><p style="${eyebrow}">01 / Tu foco ahora</p><h2 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;font-weight:400;color:#00051e;">${attention > 0 ? 'Lo que merece tu atención' : 'Sin pendientes en este resumen'}</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#e9f2ff" style="padding:4px 20px;border-left:3px solid #4692ff;"><table width="100%" cellpadding="0" cellspacing="0"><caption style="display:none;mso-hide:all;">Pendientes al generar el informe</caption>${attentionRow('Seguimientos vencidos',metrics[2][1])}${attentionRow('Facturas vencidas',metrics[4][1])}${attentionRow('Presupuestos pendientes de respuesta',metrics[5][1],true)}</table></td></tr></table><p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#585b6a;">Situación al generar el informe. Consulta el panel para ver el estado actual.</p></td></tr>
<tr><td class="side-pad" bgcolor="#ffffff" style="padding:32px 40px 0;"><p style="${eyebrow}">02 / La actividad de la semana</p><h2 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;font-weight:400;color:#00051e;">Cada movimiento cuenta.</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>${activityCell(metrics[0][0],metrics[0][1])}${activityCell(metrics[1][0],metrics[1][1])}</tr><tr>${activityCell(metrics[3][0],metrics[3][1])}${activityCell(metrics[7][0],metrics[7][1])}</tr></table><p style="${labelStyle}">${escapeHtml(issuanceNote)}</p></td></tr>
<tr><td class="side-pad" bgcolor="#ffffff" style="padding:32px 40px;"><p style="${eyebrow}">03 / Mira hacia delante</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#fcfbf7" style="padding:20px;border:1px solid #eceae3;"><p style="margin:0 0 7px;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;color:#00051e;">${number(metrics[6][1])} ${metrics[6][1] === 1 ? 'tarea en el horizonte' : 'tareas en el horizonte'}</p><p style="${labelStyle}">Tareas de la semana siguiente al periodo del informe. ${escapeHtml(recurrenceNote)}</p></td></tr></table></td></tr>
<tr><td class="side-pad" bgcolor="#00051e" style="padding:30px 40px;background-color:#00051e;"><h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:36px;font-weight:400;color:#fcfbf7;">La próxima decisión es tuya.</h2><p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#c7ccda;">Abre tu panel y convierte estas cifras en próximos pasos.</p><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#82daff" style="border-radius:28px;background-color:#82daff;mso-padding-alt:15px 24px;"><a class="panel-button" href="${escapeHtml(panelUrl)}" style="display:inline-block;padding:15px 24px;border:1px solid #82daff;border-radius:28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;font-weight:700;color:#00051e;text-decoration:none;mso-padding-alt:0;">Abrir el panel &nbsp; &rarr;</a></td></tr></table></td></tr>
<tr><td class="side-pad" bgcolor="#fcfbf7" style="padding:24px 40px;border-radius:0 0 18px 18px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#585b6a;">${escapeHtml(notice)}<br>Este mensaje contiene cifras agregadas, sin datos identificables de clientes ni documentos.</p><p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#585b6a;">Un recurso de <a href="https://www.moiraordo.es" style="font-weight:700;color:#1f63cc;text-decoration:underline;">MoiraOrdo</a> · Diseño con intención. Tecnología a medida.</p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
  return { subject:`${options.isTest ? '[PRUEBA] ' : ''}Resumen semanal · ${range}`, text, html }
}
