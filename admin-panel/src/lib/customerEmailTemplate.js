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
      es:{subject:'Presupuesto {{quote_number}} · {{company_name}}',preheader:'Revisa y responde al presupuesto que te ha enviado {{company_name}}.',html:'<p>Hola {{customer_name}},</p><p>Ya puedes revisar el presupuesto <strong>{{quote_number}}</strong>.</p><p>Acepta o rechaza la propuesta desde el siguiente enlace:</p><p><a href="{{approval_url}}">Revisar presupuesto</a></p><p>El enlace caduca el {{expires_at}}.</p>'},
      en:{subject:'Quote {{quote_number}} from {{company_name}}',preheader:'Review and respond to the quote from {{company_name}}.',html:'<p>Hello {{customer_name}},</p><p>Your quote <strong>{{quote_number}}</strong> is ready to review.</p><p>Accept or reject the offer using the following link:</p><p><a href="{{approval_url}}">Review quote</a></p><p>This link expires on {{expires_at}}.</p>'},
    },
    invoice_due:{
      es:{subject:'Aviso de vencimiento · Factura {{invoice_number}}',preheader:'Hay un saldo pendiente de {{balance}} en la factura {{invoice_number}}.',html:'<p>Te recordamos que la factura <strong>{{invoice_number}}</strong> venció el <strong>{{due_date}}</strong>.</p><p>Saldo pendiente: <strong>{{balance}}</strong>.</p><p>Si ya has realizado el pago, puedes ignorar este mensaje.</p>'},
      en:{subject:'Payment reminder · Invoice {{invoice_number}}',preheader:'Invoice {{invoice_number}} has an outstanding balance of {{balance}}.',html:'<p>This is a reminder that invoice <strong>{{invoice_number}}</strong> was due on <strong>{{due_date}}</strong>.</p><p>Outstanding balance: <strong>{{balance}}</strong>.</p><p>If you have already paid, please ignore this message.</p>'},
    },
  },
})

export const resolveCustomerEmailLanguage=brand=>brand?.emailLanguage==='en'?'en':'es'

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
  validatePlaceholders(String(chosen.subject||''),variables)
  validatePlaceholders(String(chosen.preheader||''),variables)
  validatePlaceholders(String(chosen.html||fallback.html),variables)
  const subject=normalizeSubject(fillTemplate(subjectValues(chosen),values,variables,false))
  const preheaderText=fillTemplate(String(chosen.preheader||'').slice(0,240),values,variables,false)
  const preheader=escapeText(preheaderText)
  const body=fillTemplate(sanitizeCustomerEmailHtml(chosen.html||fallback.html),values,variables)
  const logo=safeLogo(brand.logo)
  const senderTextColor=contrast(palette.accent,'#ffffff')>=contrast(palette.accent,'#000000')?'#ffffff':'#000000'
  const logoSource=preview?logo:'cid:company-email-logo'
  const logoMarkup=logo?`<img src="${escapeHtml(logoSource)}" alt="" style="display:block;width:auto;max-width:72px;max-height:48px;height:auto;object-fit:contain;border:0">`:''
  const senderNotice=locale==='en'?'This message is from':'Este mensaje te lo envía'
  const powered=locale==='en'?'Digital service powered by':'Recurso digital powered by'
  const poweredHtml=`${powered} <a href="https://www.moiraordo.es" style="color:${palette.muted};text-decoration:underline">MoiraOrdo</a>`
  const styledBody=body.replace(/<a href="([^"]+)">([\s\S]*?)<\/a>/gi,(_,href,label)=>`<a href="${href}" role="button" style="display:inline-block;padding:12px 18px;border:1px solid ${palette.accent};border-radius:7px;background:${palette.accent};color:${senderTextColor};font:700 14px/1.3 Arial,Helvetica,sans-serif;text-align:center;text-decoration:none">${label}</a>`)
  const identityCopy=`<div style="font-size:12px;line-height:1.4">${senderNotice}</div><div style="margin-top:3px;font-size:17px;line-height:1.25;font-weight:700;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(company)}</div>`
  const classicLogoCell=logoMarkup?`<td width="88" valign="middle" style="width:88px;padding:0 16px 0 0">${logoMarkup}</td>`:''
  const classicHeader=`<div style="padding:14px 22px;border-left:4px solid ${palette.accent};border-bottom:1px solid ${palette.surface};background:${palette.surface};color:${palette.ink};font:13px/1.5 Arial,Helvetica,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse"><tr>${classicLogoCell}<td valign="middle" style="min-width:0;overflow-wrap:anywhere;word-break:break-word">${identityCopy}</td></tr></table></div>`
  const boldLogoCell=logoMarkup?`<td width="96" valign="middle" style="width:96px;padding:10px 18px 10px 10px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#ffffff;border-radius:8px"><tr><td style="padding:8px">${logoMarkup}</td></tr></table></td>`:''
  const boldHeader=`<div style="padding:18px 22px;background:${palette.accent};color:${senderTextColor};font-family:Arial,Helvetica,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse"><tr>${boldLogoCell}<td valign="middle" style="min-width:0;overflow-wrap:anywhere;word-break:break-word"><div style="font-size:11px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase;overflow-wrap:anywhere;word-break:break-word">${senderNotice}</div><div style="margin-top:4px;font-size:20px;line-height:1.2;font-weight:700;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(company)}</div></td></tr></table></div>`
  const shell=brand.layout==='bold'
    ? `<div style="max-width:620px;margin:0 auto;background:${palette.paper};border:1px solid ${palette.surface};border-radius:14px;overflow:hidden">${boldHeader}<div style="padding:28px 26px;color:${palette.ink};font:15px/1.6 Arial,Helvetica,sans-serif">${styledBody}</div></div>`
    : `<div style="max-width:620px;margin:0 auto;background:${palette.paper};border:1px solid ${palette.surface};border-radius:4px;overflow:hidden">${classicHeader}<div style="padding:24px 26px;color:${palette.ink};font:15px/1.6 Arial,Helvetica,sans-serif">${styledBody}</div></div>`
  const footer=`<div style="max-width:620px;margin:0 auto;padding:16px 10px;color:${palette.muted};font:12px/1.5 Arial,Helvetica,sans-serif;text-align:center">${poweredHtml}</div>`
  const html=`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:24px 12px;background:${palette.surface};font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>${shell}${footer}</body></html>`
  const plainBody=htmlToText(body)
  const text=`${senderNotice} ${company}\n\n${plainBody}\n\n${powered} MoiraOrdo (https://www.moiraordo.es)`
  const jpeg=logo.startsWith('data:image/jpeg;')
  const attachments=logo&&!preview?[{filename:jpeg?'company-logo.jpg':'company-logo.png',content:logo.split(',')[1],content_id:'company-email-logo',content_type:jpeg?'image/jpeg':'image/png'}]:[]
  return {subject,preheader:preheaderText,html,text,attachments}
}

export const renderCustomerEmailPreview=(options)=>renderCustomerBillingEmail(options).html
