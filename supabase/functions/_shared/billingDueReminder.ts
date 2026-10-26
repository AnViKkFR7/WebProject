export interface BillingDueReminderPayload {
  company_id: string
  invoice_id: string
  recipient_email: string | null
  invoice_number: string
  due_date: string
  balance: number | string
}

const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

export function buildBillingDueReminder(payload:BillingDueReminderPayload){
  if(!payload.company_id||!payload.invoice_id||!payload.recipient_email||!payload.invoice_number?.trim())throw new Error('Reminder payload incomplete')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(payload.due_date)||!Number.isFinite(Number(payload.balance))||Number(payload.balance)<=0)throw new Error('Reminder payload invalid')
  const [year,month,day]=payload.due_date.split('-').map(Number)
  const dueDate=new Date(Date.UTC(year,month-1,day))
  if(dueDate.toISOString().slice(0,10)!==payload.due_date)throw new Error('Reminder due date invalid')
  const dateLabel=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'numeric',month:'long',year:'numeric'}).format(dueDate)
  const balance=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(payload.balance))
  const number=payload.invoice_number.trim()
  const subject=`Aviso de vencimiento · Factura ${number}`
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#192333"><main style="max-width:560px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e1e5ec;border-radius:14px"><p style="margin:0 0 10px;color:#5c55e8;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Aviso de vencimiento</p><h1 style="margin:0 0 18px;font-size:23px">Factura pendiente de pago</h1><p style="line-height:1.6">Te recordamos que la factura <strong>${escapeHtml(number)}</strong> venció el <strong>${escapeHtml(dateLabel)}</strong>.</p><p style="margin:22px 0;padding:16px;background:#f6f7fb;border-radius:10px"><span style="display:block;color:#667085;font-size:13px">Saldo pendiente</span><strong style="font-size:21px">${escapeHtml(balance)}</strong></p><p style="font-size:13px;line-height:1.6;color:#667085">Si ya has realizado el pago, puedes ignorar este mensaje.</p></main></body></html>`
  const text=`Aviso de vencimiento\n\nLa factura ${number} venció el ${dateLabel}.\nSaldo pendiente: ${balance}.\n\nSi ya has realizado el pago, puedes ignorar este mensaje.`
  return {subject,html,text}
}
