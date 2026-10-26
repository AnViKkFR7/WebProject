export type QuoteApprovalLinkPayload={recipient_email:string;recipient_name:string;company_name:string;quote_number:string;expires_at:string}
export type QuoteApprovalNoticePayload={link_id:string;response_id:string;quote_id:string;quote_number:string;company_name:string;recipient_emails:string[];decision:'accepted'|'rejected';customer_name:string;customer_email:string;responded_at:string}

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]||character)
const dateLabel=(value:string)=>new Intl.DateTimeFormat('es-ES',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(value))

export function buildQuoteApprovalLinkEmail(payload:QuoteApprovalLinkPayload,url:string){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.recipient_email)||!/^https:\/\//.test(url))throw new Error('Invalid quote email payload')
  const company=payload.company_name||'La empresa'
  const subject=`Presupuesto ${payload.quote_number} · ${company}`
  const text=`Hola ${payload.recipient_name||''},\n\n${company} te ha enviado el presupuesto ${payload.quote_number}. Puedes revisarlo y aceptar o rechazarlo aquí:\n${url}\n\nEl enlace caduca el ${dateLabel(payload.expires_at)}.`
  const html=`<main style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#17324f"><h1 style="font-size:22px">Presupuesto ${escapeHtml(payload.quote_number)}</h1><p>Hola ${escapeHtml(payload.recipient_name||'')},</p><p>${escapeHtml(company)} te ha enviado un presupuesto. Puedes revisarlo y registrar tu respuesta desde el siguiente enlace:</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;border-radius:7px;background:#4338ca;color:#fff;text-decoration:none">Revisar presupuesto</a></p><p>El enlace caduca el ${escapeHtml(dateLabel(payload.expires_at))}.</p></main>`
  return{subject,text,html}
}

export function buildQuoteApprovalNoticeEmail(payload:QuoteApprovalNoticePayload,url:string){
  if(!payload.quote_number||!payload.customer_email||!/^https:\/\//.test(url))throw new Error('Invalid quote response notice')
  const accepted=payload.decision==='accepted'
  const subject=`Presupuesto ${payload.quote_number} · ${accepted?'aceptado':'rechazado'}`
  const decision=accepted?'aceptado':'rechazado'
  const text=`${payload.customer_name} (${payload.customer_email}) ha ${decision} el presupuesto ${payload.quote_number} de ${payload.company_name}.\nFecha: ${dateLabel(payload.responded_at)}\n\nAbrir presupuesto: ${url}`
  const html=`<main style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#17324f"><h1 style="font-size:22px">Presupuesto ${escapeHtml(decision)}</h1><p><strong>${escapeHtml(payload.customer_name)}</strong> (${escapeHtml(payload.customer_email)}) ha ${escapeHtml(decision)} el presupuesto <strong>${escapeHtml(payload.quote_number)}</strong>.</p><p>${escapeHtml(dateLabel(payload.responded_at))}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;border-radius:7px;background:#4338ca;color:#fff;text-decoration:none">Abrir presupuesto</a></p></main>`
  return{subject,text,html}
}

export function splitQuoteNoticeRecipients(value:unknown){
  const recipients=Array.isArray(value)?value.filter((email):email is string=>typeof email==='string'&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)):[]
  const unique=[...new Map(recipients.map(email=>[email.toLocaleLowerCase(),email])).values()]
  return{to:unique[0]||null,bcc:unique.slice(1)}
}
