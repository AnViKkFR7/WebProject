export const emailTemplateKinds = ['quote_approval','invoice_due']
export const emailTemplateLanguages = ['es','en']
export const emailLayouts = ['classic','bold']
export const customerEmailVariables = {
  quote_approval:['company_name','customer_name','quote_number','approval_url','expires_at'],
  invoice_due:['company_name','invoice_number','due_date','balance'],
}

export const defaultCustomerEmailSettings = () => ({
  brand:{layout:'classic',logo:'',emailLanguage:'es',palette:{id:'graphite',accent:'#334155',ink:'#20252b',muted:'#58616d',paper:'#ffffff',surface:'#f1f3f5'}},
  templates:{
    quote_approval:{
      es:{subject:'Presupuesto {{quote_number}} · {{company_name}}',preheader:'Revisa y responde al presupuesto que te ha enviado {{company_name}}.',html:'<p>Hola {{customer_name}},</p><p>Hemos preparado una propuesta para ti. Revisa los detalles y responde desde el botón cuando quieras.</p><p><a href="{{approval_url}}">Revisar presupuesto</a></p>'},
      en:{subject:'Quote {{quote_number}} from {{company_name}}',preheader:'Review and respond to the quote from {{company_name}}.',html:'<p>Hello {{customer_name}},</p><p>We have prepared a proposal for you. Review the details and send your response using the button.</p><p><a href="{{approval_url}}">Review quote</a></p>'},
    },
    invoice_due:{
      es:{subject:'Aviso de vencimiento · Factura {{invoice_number}}',preheader:'Saldo pendiente {{balance}} · Factura {{invoice_number}}.',html:'<p>Te enviamos este aviso porque la factura sigue pendiente de pago.</p><p>Si ya has realizado el pago, puedes ignorar este mensaje. Si tienes alguna duda, ponte en contacto con la empresa.</p>'},
      en:{subject:'Payment reminder · Invoice {{invoice_number}}',preheader:'Outstanding balance {{balance}} · Invoice {{invoice_number}}.',html:'<p>We are sending this reminder because the invoice is still awaiting payment.</p><p>If you have already paid, please ignore this message. If you have any questions, contact the company.</p>'},
    },
  },
})

export const resolveCustomerEmailLanguage=brand=>brand?.emailLanguage==='en'?'en':'es'

const legacyDefaultHtml={
  quote_approval:{
    es:'<p>Hola {{customer_name}},</p><p>Ya puedes revisar el presupuesto <strong>{{quote_number}}</strong>.</p><p>Acepta o rechaza la propuesta desde el siguiente enlace:</p><p><a href="{{approval_url}}">Revisar presupuesto</a></p><p>El enlace caduca el {{expires_at}}.</p>',
    en:'<p>Hello {{customer_name}},</p><p>Your quote <strong>{{quote_number}}</strong> is ready to review.</p><p>Accept or reject the offer using the following link:</p><p><a href="{{approval_url}}">Review quote</a></p><p>This link expires on {{expires_at}}.</p>',
  },
  invoice_due:{
    es:'<p>Te recordamos que la factura <strong>{{invoice_number}}</strong> venció el <strong>{{due_date}}</strong>.</p><p>Saldo pendiente: <strong>{{balance}}</strong>.</p><p>Si ya has realizado el pago, puedes ignorar este mensaje.</p>',
    en:'<p>This is a reminder that invoice <strong>{{invoice_number}}</strong> was due on <strong>{{due_date}}</strong>.</p><p>Outstanding balance: <strong>{{balance}}</strong>.</p><p>If you have already paid, please ignore this message.</p>',
  },
}

/** Upgrade exact built-in bodies without changing any user-edited email copy. */
export function upgradeDefaultCustomerEmailBodies(settings){
  if(!settings||typeof settings!=='object')return settings
  let templates=settings.templates
  for(const kind of emailTemplateKinds)for(const locale of emailTemplateLanguages){
    const current=templates?.[kind]?.[locale]
    const replacement=fallbackSettings.templates[kind][locale].html
    if(current?.html===legacyDefaultHtml[kind][locale]){
      if(templates===settings.templates)templates={...templates}
      templates[kind]={...templates[kind], [locale]:{...current,html:replacement}}
    }
  }
  return templates===settings.templates?settings:{...settings,templates}
}

const safeTags=new Set(['p','div','h1','h2','h3','strong','b','em','i','u','ul','ol','li','br','hr','blockquote','table','thead','tbody','tr','td','th','span','a'])
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const normalizeSubject=value=>[...String(value??'')].map(character=>character.charCodeAt(0)<32||character.charCodeAt(0)===127?' ':character).join('').replace(/[ \t]+/g,' ').trim().slice(0,180)

/** Allows a deliberately small HTML vocabulary and only safe anchor URLs. */
export function sanitizeCustomerEmailHtml(source) {
  if(typeof source!=='string'||source.length<1||source.length>50000)throw new Error('Invalid template size')
  if(/<(?:script|style|iframe|object|embed|form|input|button|svg|math|video|audio|meta|link|base)\b|\son[a-z]+\s*=|javascript\s*:|data\s*:/i.test(source))throw new Error('Unsafe email HTML')
  return source.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,tag=>{
    const match=tag.match(/^<\s*(\/?)\s*([a-z][a-z0-9]*)\s*([^>]*)>$/i)
    if(!match)throw new Error('Invalid email HTML tag')
    const closing=Boolean(match[1]),name=match[2].toLowerCase(),attributes=match[3].trim()
    if(!safeTags.has(name))throw new Error('Unsupported email HTML tag')
    if(closing)return `</${name}>`
    if(name==='a'){
      const href=attributes.match(/^href\s*=\s*(["'])(.*?)\1\s*$/i)?.[2]
      if(!href||(!/^\{\{(?:approval_url)\}\}$/.test(href)&&!/^https:\/\//i.test(href)&&!/^mailto:[^\s<>@]+@[^\s<>@]+$/i.test(href)))throw new Error('Unsafe email link')
      return `<a href="${escapeHtml(href)}">`
    }
    if(attributes)throw new Error('Unsupported email HTML attribute')
    return `<${name}>`
  })
}

const fallbackSettings=defaultCustomerEmailSettings()
const validHex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)
const contrast=(first,second)=>{
  const luminance=color=>{
    const channels=color.slice(1).match(/../g).map(channel=>parseInt(channel,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2)
    return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2]
  }
  const values=[luminance(first),luminance(second)].sort((a,b)=>b-a)
  return (values[0]+0.05)/(values[1]+0.05)
}
const escapeText=value=>escapeHtml(value).replace(/\n/g,'<br>')
const safePalette=brand=>{
  const candidate=brand?.palette||fallbackSettings.brand.palette
  return Object.fromEntries(['accent','ink','muted','paper','surface'].map(key=>[key,validHex(candidate[key])?candidate[key]:fallbackSettings.brand.palette[key]]))
}
const subjectValues=template=>normalizeSubject(template?.subject)||'Notificación de {{company_name}}'
const safeLogo=logo=>typeof logo==='string'&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(logo)&&logo.length<=1400000?logo:''

function fillTemplate(source,values,allowedVariables,html=true) {
  return source.replace(/\{\{([a-z_]+)\}\}/g,(placeholder,key)=>{
    if(!allowedVariables.includes(key))throw new Error(`Unsupported email placeholder: ${key}`)
    const value=values[key]??''
    if(key==='approval_url'){
      if(typeof value!=='string'||!/^https:\/\//i.test(value))throw new Error('Invalid approval URL')
      return escapeHtml(value)
    }
    return html?escapeText(value):[...String(value??'')].map(character=>character.charCodeAt(0)<32||character.charCodeAt(0)===127?' ':character).join('')
  })
}

function validatePlaceholders(source,allowedVariables) {
  const remaining=source.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>{
    if(!allowedVariables.includes(key))throw new Error(`Unsupported email placeholder: ${key}`)
    return ''
  })
  if(/\{\{|\}\}/.test(remaining))throw new Error('Malformed email placeholder')
}

function htmlToText(html) {
  return html.replace(/<\/(?:p|div|h1|h2|h3|li|tr|blockquote)>/gi,'\n\n').replace(/<br\s*\/?>/gi,'\n').replace(/<a href="([^"]+)">([\s\S]*?)<\/a>/gi,'$2 ($1)').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/g,"'").replace(/\n{3,}/g,'\n\n').trim()
}

/** Render one customer email. Brand fields are common, template HTML is per message type. */
export function renderCustomerBillingEmail({kind,language='es',companyName,data={},brand={},template,preview=false}) {
  if(!emailTemplateKinds.includes(kind))throw new Error('Unsupported customer email kind')
  const locale=emailTemplateLanguages.includes(language)?language:'es'
  const fallback=fallbackSettings.templates[kind][locale]
  const chosen=template||fallback
  const palette=safePalette(brand)
  const company=String(companyName||data.company_name||'La empresa').slice(0,200)
  const variables=customerEmailVariables[kind]
  const values={...data,company_name:company}
  const configuredHtml=String(chosen.html||fallback.html)
  const bodySource=configuredHtml===legacyDefaultHtml[kind][locale]?fallback.html:configuredHtml
  validatePlaceholders(String(chosen.subject||''),variables)
  validatePlaceholders(String(chosen.preheader||''),variables)
  validatePlaceholders(bodySource,variables)
  const subject=normalizeSubject(fillTemplate(subjectValues(chosen),values,variables,false))
  const preheaderText=fillTemplate(String(chosen.preheader||'').slice(0,240),values,variables,false)
  const preheader=escapeText(preheaderText)
  const body=fillTemplate(sanitizeCustomerEmailHtml(bodySource),values,variables)
  const logo=safeLogo(brand.logo)
  const headerColor=brand.layout==='bold'?palette.accent:palette.ink
  const senderTextColor=contrast(headerColor,'#ffffff')>=contrast(headerColor,'#000000')?'#ffffff':'#000000'
  const buttonTextColor=contrast(palette.accent,'#ffffff')>=contrast(palette.accent,'#000000')?'#ffffff':'#000000'
  const logoSource=preview?logo:'cid:company-email-logo'
  const logoMarkup=logo?`<img src="${escapeHtml(logoSource)}" alt="" width="72" style="display:block;width:auto;max-width:72px;max-height:48px;height:auto;object-fit:contain;border:0">`:''
  const senderNotice=locale==='en'?'This message is from':'Este mensaje te lo envía'
  const powered=locale==='en'?'Digital service powered by':'Recurso digital powered by'
  const poweredHtml=`${powered} <a href="https://www.moiraordo.es" style="color:${palette.muted};text-decoration:underline">MoiraOrdo</a>`
  const buttonRadius=brand.layout==='bold'?'7px':'30px'
  const styledBody=body.replace(/<a href="([^"]+)">([\s\S]*?)<\/a>/gi,(_,href,label)=>{
    if(kind==='quote_approval'&&href===escapeHtml(data.approval_url||''))return `<a href="${href}" class="action-link" style="display:inline-block;padding:14px 24px;border:1px solid ${palette.accent};border-radius:${buttonRadius};background:${palette.accent};color:${buttonTextColor};font:700 14px/1.4 Arial,Helvetica,sans-serif;text-align:center;text-decoration:none">${label}</a>`
    return `<a href="${href}" style="color:${palette.accent};text-decoration:underline;overflow-wrap:anywhere">${label}</a>`
  })
  const logoCell=logoMarkup?`<td width="88" valign="middle" style="width:88px;padding:0 18px 0 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border-radius:9px"><tr><td style="padding:8px">${logoMarkup}</td></tr></table></td>`:''
  const senderCopy=`<div style="font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:${senderTextColor}">${senderNotice}</div><div style="margin-top:3px;font:700 20px/26px Arial,Helvetica,sans-serif;color:${senderTextColor};overflow-wrap:anywhere;word-break:break-word">${escapeHtml(company)}</div>`
  const headline=locale==='en'?'Your proposal is ready':'Tu propuesta está lista'
  const eyebrow=locale==='en'?'QUOTE · CUSTOMER APPROVAL':'PRESUPUESTO · RESPUESTA DEL CLIENTE'
  const summaryHtml=kind==='quote_approval'
    ?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;border:1px solid ${palette.surface};border-left:4px solid ${palette.accent};background:${palette.surface}"><tr><td style="padding:15px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed"><tr><td valign="top" style="width:50%;padding-right:10px"><p style="margin:0 0 5px;font:700 10px/15px Arial,Helvetica,sans-serif;letter-spacing:1.3px;text-transform:uppercase;color:${palette.muted}">${locale==='en'?'QUOTE':'PRESUPUESTO'}</p><p style="margin:0;font:700 17px/24px Arial,Helvetica,sans-serif;color:${palette.ink};overflow-wrap:anywhere">${escapeText(data.quote_number)}</p></td><td valign="top" style="width:50%;padding-left:10px"><p style="margin:0 0 5px;font:700 10px/15px Arial,Helvetica,sans-serif;letter-spacing:1.3px;text-transform:uppercase;color:${palette.muted}">${locale==='en'?'VALID UNTIL':'VÁLIDO HASTA'}</p><p style="margin:0;font:15px/24px Arial,Helvetica,sans-serif;color:${palette.ink};overflow-wrap:anywhere">${escapeText(data.expires_at)}</p></td></tr></table></td></tr></table>`
    :`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;border:1px solid ${palette.surface};border-left:4px solid ${palette.accent};background:${palette.surface}"><tr><td style="padding:17px 20px"><p style="margin:0 0 7px;font:700 10px/15px Arial,Helvetica,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:${palette.accent}">${locale==='en'?'PAYMENT SUMMARY':'RESUMEN DEL PAGO'}</p><p style="margin:0 0 4px;font:700 10px/15px Arial,Helvetica,sans-serif;letter-spacing:1.3px;text-transform:uppercase;color:${palette.muted}">${locale==='en'?'OUTSTANDING BALANCE':'SALDO PENDIENTE'}</p><p style="margin:0;font:400 30px/38px Georgia,'Times New Roman',serif;color:${palette.ink};overflow-wrap:anywhere">${escapeText(data.balance)}</p><p style="margin:12px 0 0;padding-top:10px;border-top:1px solid ${palette.surface};font:13px/21px Arial,Helvetica,sans-serif;color:${palette.ink};overflow-wrap:anywhere">${locale==='en'?'Invoice':'Factura'} <strong>${escapeText(data.invoice_number)}</strong><br>${locale==='en'?'Due date':'Fecha de vencimiento'}: <strong>${escapeText(data.due_date)}</strong></p></td></tr></table>`
  const summaryText=kind==='quote_approval'
    ?`${locale==='en'?'Quote':'Presupuesto'} ${String(data.quote_number||'')} · ${locale==='en'?'Valid until':'Válido hasta'} ${String(data.expires_at||'')}`
    :`${locale==='en'?'Outstanding balance':'Saldo pendiente'} ${String(data.balance||'')} · ${locale==='en'?'Invoice':'Factura'} ${String(data.invoice_number||'')} · ${locale==='en'?'Due':'Vencimiento'} ${String(data.due_date||'')}`
  const invoiceEyebrow=locale==='en'?'INVOICE · PAYMENT REMINDER':'FACTURA · AVISO DE VENCIMIENTO'
  const invoiceHeadline=locale==='en'?'A balance to review':'Hay un saldo pendiente'
  const invoiceIntro=locale==='en'?'This invoice is still awaiting payment. Here is a summary for you to review.':'Esta factura sigue pendiente de pago. Te dejamos el resumen para que puedas revisarla.'
  const heroEyebrow=kind==='quote_approval'?eyebrow:invoiceEyebrow
  const heroHeadline=kind==='quote_approval'?headline:invoiceHeadline
  const heroIntro=kind==='invoice_due'?`<p style="margin:14px 0 0;font:14px/23px Arial,Helvetica,sans-serif;color:${palette.muted}">${invoiceIntro}</p>`:''
  const contentSection=brand.layout==='bold'
    ?`<tr><td class="side-pad" bgcolor="${palette.paper}" style="padding:26px 34px 30px;background-color:${palette.paper}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;background:${palette.surface};border-left:7px solid ${palette.accent};border-radius:0 12px 12px 0"><tr><td style="padding:24px 22px"><p style="display:inline-block;margin:0 0 12px;padding:5px 9px;border-radius:4px;background:${palette.paper};font:700 10px/15px Arial,Helvetica,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:${palette.accent}">${heroEyebrow}</p><h1 class="hero-title" style="margin:0;font:700 31px/37px Arial,Helvetica,sans-serif;letter-spacing:-.7px;color:${palette.ink}">${heroHeadline}<span style="color:${palette.accent}">.</span></h1>${heroIntro}${summaryHtml}</td></tr></table></td></tr>`
    :kind==='quote_approval'
      ?`<tr><td class="side-pad" bgcolor="${palette.paper}" style="padding:30px 34px 25px;background-color:${palette.paper}"><p style="margin:0 0 12px;font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:${palette.accent}">${eyebrow}</p><h1 class="hero-title" style="margin:0;font:400 38px/44px Georgia,'Times New Roman',serif;letter-spacing:-1.2px;color:${palette.ink}">${headline}<span style="color:${palette.accent}">.</span></h1>${summaryHtml}</td></tr>`
      :`<tr><td class="side-pad" bgcolor="${palette.paper}" style="padding:30px 34px 25px;background-color:${palette.paper}"><p style="margin:0 0 12px;font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:${palette.accent}">${invoiceEyebrow}</p><h1 class="hero-title" style="margin:0;font:400 38px/44px Georgia,'Times New Roman',serif;letter-spacing:-1.2px;color:${palette.ink}">${invoiceHeadline}<span style="color:${palette.accent}">.</span></h1><p style="margin:14px 0 0;font:14px/23px Arial,Helvetica,sans-serif;color:${palette.muted}">${invoiceIntro}</p>${summaryHtml}</td></tr>`
  const shell=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;border:1px solid ${palette.surface};border-radius:18px;border-collapse:separate;overflow:hidden;background:${palette.paper}">
    <tr><td class="side-pad" bgcolor="${headerColor}" style="padding:26px 34px;background-color:${headerColor};border-radius:17px 17px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse"><tr>${logoCell}<td valign="middle" style="min-width:0;overflow-wrap:anywhere;word-break:break-word">${senderCopy}</td></tr></table></td></tr>
    ${contentSection}
    <tr><td class="side-pad" bgcolor="${palette.paper}" style="padding:24px 34px 30px;border-top:1px solid ${palette.surface};background-color:${palette.paper};color:${palette.ink};font:15px/1.7 Arial,Helvetica,sans-serif;overflow-wrap:anywhere;word-break:break-word">${styledBody}</td></tr>
    <tr><td height="14" bgcolor="${palette.paper}" style="height:14px;background-color:${palette.paper};border-radius:0 0 17px 17px"></td></tr>
  </table>`
  const html=`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(subject)}</title><style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}table{border-collapse:collapse}@media screen and (max-width:640px){.outer-pad{padding:18px 10px!important}.side-pad{padding-left:24px!important;padding-right:24px!important}.hero-title{font-size:33px!important;line-height:39px!important}.action-link{display:block!important;text-align:center!important}}</style></head><body style="margin:0;padding:0;background-color:${palette.surface};color:${palette.ink};font-family:Arial,Helvetica,sans-serif"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${preheader}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${palette.surface}"><tr><td class="outer-pad" align="center" style="padding:34px 18px">${shell}<p style="margin:17px auto 0;font:10px/17px Arial,Helvetica,sans-serif;color:${palette.muted};text-align:center">${poweredHtml}</p></td></tr></table></body></html>`
  const plainBody=htmlToText(body)
  const textTitle=kind==='quote_approval'?headline:(locale==='en'?'A balance to review':'Hay un saldo pendiente')
  const text=`${senderNotice} ${company}\n\n${textTitle}.\n${summaryText}\n\n${plainBody}\n\n${powered} MoiraOrdo (https://www.moiraordo.es)`
  const jpeg=logo.startsWith('data:image/jpeg;')
  const attachments=logo&&!preview?[{filename:jpeg?'company-logo.jpg':'company-logo.png',content:logo.split(',')[1],content_id:'company-email-logo',content_type:jpeg?'image/jpeg':'image/png'}]:[]
  return {subject,preheader:preheaderText,html,text,attachments}
}

export const renderCustomerEmailPreview=(options)=>renderCustomerBillingEmail(options).html
