import { validBillingPalette, withBillingAppearance } from './billingAppearance'

export const emptyProfile = { name: '', taxId: '', address: '', email: '', phone: '', logo: '', color: '#635bff', prefix: 'F', quotePrefix: 'P', iban: '', payment: '', notes: '' }
export const newLine = () => ({ description: '', quantity: 1, price: 0, discount: 0, tax: 21 })
// Cantidades en milésimas; importes en céntimos; porcentajes en centésimas.
// Evita discrepancias de redondeo entre JavaScript y numeric de PostgreSQL.
const scaled = (value, precision) => {
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= 1e12
    ? BigInt(number.toFixed(precision).replace('.', '')) : 0n
}
const divideRounded = (value, divisor) => value < 0n
  ? -((-value + divisor / 2n) / divisor) : (value + divisor / 2n) / divisor
const euros = cents => Number(cents) / 100

export function invoiceTotals(lines, withholding = 0) {
  let baseCents = 0n; let taxCents = 0n
  const rows = lines.map(line => {
    const base = divideRounded(scaled(line.quantity,3) * scaled(line.price,2) * (10000n-scaled(line.discount || 0,2)),10000000n)
    const tax = divideRounded(base * scaled(line.tax,2),10000n)
    baseCents += base; taxCents += tax
    const original=divideRounded(scaled(line.quantity,3)*scaled(line.price,2),1000n)
    return { original:euros(original),discount:euros(original-base),base:euros(base),tax:euros(tax),total:euros(base+tax) }
  })
  const retained = divideRounded(baseCents * scaled(withholding || 0,2),10000n)
  return { rows,base:euros(baseCents),tax:euros(taxCents),retained:euros(retained),total:euros(baseCents+taxCents-retained) }
}

const text = (value, max = 2000) => typeof value === 'string' && value.length <= max
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
export const validBillingDate = value => {
  if (!text(value,10) || !/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value
}
export function validBillingProfile(profile) {
  if (!object(profile) || !hasBillingProfile(profile)) return false
  if (!['name','taxId','address','email','phone','iban','payment','notes','prefix','quotePrefix','color'].every(key => !(key in profile) || text(profile[key]))) return false
  if (['prefix','quotePrefix'].some(key => key in profile && !/^[A-Za-z0-9_-]{1,20}$/.test(profile[key]))) return false
  if ('color' in profile && !/^#[0-9a-f]{6}$/i.test(profile.color)) return false
  if ('palette' in profile && !validBillingPalette(profile.palette)) return false
  return !('logo' in profile) || (text(profile.logo,1400000) && (profile.logo === '' || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(profile.logo)))
}
const validNumber = (value, precision, max, positive = false) =>
  ['string','number'].includes(typeof value) && new RegExp(`^[0-9]+([.][0-9]{1,${precision}})?$`).test(String(value))
  && Number.isFinite(Number(value)) && Number(value) <= max && (positive ? Number(value)>0 : Number(value)>=0)

export function validInvoice(doc) {
  if (!object(doc) || !object(doc.customer) || !validBillingProfile(doc.issuer)) return false
  if (!['name','taxId','address'].every(key => text(doc.customer[key]) && doc.customer[key].trim())) return false
  if ('email' in doc.customer && !text(doc.customer.email)) return false
  if (!['date','dueDate','payment','iban','notes','sourceQuote'].every(key => !(key in doc) || text(doc[key]))) return false
  if ('presentation' in doc && (!object(doc.presentation) || !['title','site','introduction','conditions'].every(key => !(key in doc.presentation) || text(doc.presentation[key],['title','site'].includes(key) ? 300 : 2000)) || ('signatures' in doc.presentation && typeof doc.presentation.signatures !== 'boolean'))) return false
  if (!validBillingDate(doc.date) || (doc.dueDate && (!validBillingDate(doc.dueDate) || doc.dueDate<doc.date))) return false
  if (!validNumber(doc.withholding,2,100) || !Array.isArray(doc.lines) || doc.lines.length<1 || doc.lines.length>1000) return false
  if (!doc.lines.every(line => object(line) && text(line.description) && line.description.trim()
    && (!('chapter' in line) || text(line.chapter,200)) && (!('details' in line) || text(line.details,2000))
    && validNumber(line.quantity,3,1e9,true) && validNumber(line.price,2,1e9)
    && validNumber(line.discount,2,100) && validNumber(line.tax,2,100))) return false
  return invoiceTotals(doc.lines,doc.withholding).base <= 1e12
}

export const documentStatuses = kind => kind === 'quote'
  ? ['draft', 'sent', 'accepted', 'rejected', 'invoiced', 'cancelled']
  : ['draft', 'issued', 'paid', 'cancelled']

export function hasBillingProfile(profile) {
  return ['name', 'taxId', 'address'].every(key => typeof profile?.[key] === 'string' && profile[key].trim())
}

// El modo automático solo se activa al editar si coincide la copia guardada.
export function usesCompanyIssuer(issuer, profile) {
  return hasBillingProfile(profile) && ['name', 'taxId', 'address', 'email', 'phone', 'iban', 'payment', 'notes']
    .every(key => (issuer?.[key] || '') === (profile[key] || ''))
}

export function changeIssuerSource(editor, useCompanyIssuer, profile) {
  return {
    ...editor, useCompanyIssuer,
    customIssuer: useCompanyIssuer ? structuredClone(editor.doc.issuer) : editor.customIssuer,
    doc: { ...editor.doc, issuer: withBillingAppearance(structuredClone(useCompanyIssuer ? profile : (editor.customIssuer || editor.doc.issuer)),editor.doc.issuer) },
  }
}
