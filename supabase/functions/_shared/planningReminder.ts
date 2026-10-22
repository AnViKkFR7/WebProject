export interface ReminderTask {
  id: string
  company_id: string
  created_by: string | null
  title: string
  description?: string | null
  start_datetime: string
  end_datetime?: string | null
  is_all_day?: boolean
  type?: string
  recurrence_type?: string | null
  client_company_id?: string | null
}
export interface DueReminder {
  task_id: string
  occurrence_at?: unknown
  start_datetime?: unknown // Compatibility with the first non-recurring RPC.
  minutes_before: number
  company_id: string
  created_by: string | null
}
const zone='Europe/Madrid'
const escapeHtml=(value:unknown)=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
function instant(value:unknown):Date|null {
  if(typeof value!=='string' || !/(?:z|[+-]\d{2}(?::?\d{2})?)$/i.test(value)) return null
  const date=new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}
export function buildPlanningReminder(reminder:DueReminder,task:ReminderTask,company:string,client:string|null=null) {
  if(reminder.task_id!==task.id || reminder.company_id!==task.company_id || reminder.created_by!==task.created_by) throw new Error('Reminder/task identity mismatch')
  if(!Number.isInteger(reminder.minutes_before) || reminder.minutes_before<0 || reminder.minutes_before>10080) throw new Error('Invalid reminder interval')
  let occurrence=instant(reminder.occurrence_at)
  const persistedStart=instant(task.start_datetime)
  if(occurrence && persistedStart && (!task.recurrence_type || task.recurrence_type==='none') && occurrence.getTime()!==persistedStart.getTime()) throw new Error('Stale reminder: event start changed')
  if(!occurrence && (!task.recurrence_type || task.recurrence_type==='none')) occurrence=instant(task.start_datetime)
  // A recurring reminder must identify its actual occurrence, never the series origin.
  if(!occurrence) throw new Error('Missing valid occurrence_at; update due_planning_reminders')
  const start=instant(task.start_datetime)
  const end=instant(task.end_datetime)
  const duration=start && end ? end.getTime()-start.getTime() : 3600000
  const occurrenceEnd=new Date(occurrence.getTime()+Math.max(0,duration))
  const day=new Intl.DateTimeFormat('es-ES',{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(occurrence)
  const clock=(date:Date)=>new Intl.DateTimeFormat('es-ES',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)
  const shortDate=new Intl.DateTimeFormat('es-ES',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric'}).format(occurrence)
  const endDay=new Intl.DateTimeFormat('es-ES',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric'}).format(occurrenceEnd)
  const time=task.is_all_day ? 'Todo el día' : `${clock(occurrence)} – ${clock(occurrenceEnd)}${shortDate!==endDay ? ` (${endDay})` : ''}`
  const type:Record<string,string>={todo:'Tarea',reunion:'Reunión',entregable:'Entregable',recibir_pago:'Recibir pago',realizar_pago:'Realizar pago'}
  const notice:Record<number,string>={0:'Aviso al comenzar',60:'Aviso 1 hora antes',1440:'Aviso 1 día antes',10080:'Aviso 1 semana antes'}
  const lead=notice[reminder.minutes_before] || `Aviso ${reminder.minutes_before} minutos antes`
  const details=[['Compañía',company],...(client ? [['Cliente',client]] : []),['Tipo',type[task.type || 'todo'] || 'Evento'],['Zona horaria',zone]]
  const title=task.title || 'Evento de planning'
  const description=task.description?.trim() || ''
  const rows=details.map(([name,value])=>`<tr><td style="padding:9px 0;color:#687385;font-size:13px;width:120px;vertical-align:top">${escapeHtml(name)}</td><td style="padding:9px 0;color:#172033;font-size:14px;font-weight:600;word-break:break-word">${escapeHtml(value)}</td></tr>`).join('')
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(day)} · ${escapeHtml(time)} · ${escapeHtml(company)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px">
  <tr><td style="padding:0 8px 18px;font-size:13px;font-weight:700;letter-spacing:2px;color:#4d5361">MOIRA ORDO <span style="color:#9299a6;font-weight:400">/ PLANNING</span></td></tr>
  <tr><td style="background:#fff;border:1px solid #e0e5ed;border-radius:18px;padding:30px 26px">
  <span style="display:inline-block;background:#efedff;color:#5146b7;border-radius:20px;padding:7px 12px;font-size:12px;font-weight:700">${escapeHtml(lead)}</span>
  <h1 style="font-size:27px;line-height:1.25;margin:20px 0 22px;word-break:break-word">${escapeHtml(title)}</h1>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;border:1px solid #e6e9f0;border-radius:12px"><tr><td style="padding:20px">
  <div style="font-size:12px;color:#697389;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Fecha y hora del evento</div>
  <div style="font-size:17px;font-weight:600;line-height:1.5">${escapeHtml(day)}</div><div style="font-size:26px;font-weight:700;line-height:1.5;color:#22283a">${escapeHtml(time)}</div>
  </td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">${rows}</table>
  ${description ? `<div style="border-top:1px solid #e7eaf0;margin-top:18px;padding-top:20px"><div style="font-size:12px;color:#697389;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">Detalles del evento</div><div style="font-size:15px;line-height:1.65;word-break:break-word">${escapeHtml(description).replace(/\r?\n/g,'<br>')}</div></div>` : ''}
  </td></tr><tr><td style="padding:20px 12px;font-size:12px;line-height:1.7;color:#7a8496">Recibes este recordatorio porque configuraste un aviso para este evento. Puedes cambiarlo desde el planning de ${escapeHtml(company.replace(/\.$/,''))}.<br>Las horas se muestran en la zona horaria de Madrid.</td></tr>
  </table></td></tr></table></body></html>`
  const text=[title,lead,`${day}\n${time}`, ...details.map(([name,value])=>`${name}: ${value}`),description,'Puedes gestionar los recordatorios desde el planning.'].filter(Boolean).join('\n\n')
  return {subject:`Recordatorio: ${title.replace(/[\r\n]/g,' ').slice(0,140)} · ${shortDate}${task.is_all_day ? '' : ` ${clock(occurrence)}`}`,html,text,occurrenceAt:occurrence.toISOString()}
}
