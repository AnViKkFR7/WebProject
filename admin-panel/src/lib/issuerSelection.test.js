import { describe, expect, it } from 'vitest'
import { changeIssuerSource, hasBillingProfile, usesCompanyIssuer, documentStatuses } from './invoicing'

const profile = { name:'Company', taxId:'123', address:'Madrid', color:'#635bff', prefix:'F' }
describe('issuer selection shared by invoices and quotes', () => {
  it('requires all mandatory saved issuer details', () => {
    expect(hasBillingProfile(profile)).toBe(true)
    expect(hasBillingProfile({ ...profile, taxId:'  ' })).toBe(false)
    expect(hasBillingProfile(null)).toBe(false)
  })
  it('keeps historical issuer copies visible when company details changed', () => {
    expect(usesCompanyIssuer({ ...profile },profile)).toBe(true)
    expect(usesCompanyIssuer({ ...profile,address:'Old address' },profile)).toBe(false)
    // Fiscal source and document branding are independent; the historical logo stays in the document.
    expect(usesCompanyIssuer({ ...profile,logo:'old-logo' },profile)).toBe(true)
  })
  it('restores manually entered issuer details after toggling company details', () => {
    const custom = { ...profile,name:'Other issuer',taxId:'456' }
    const original = { useCompanyIssuer:false,doc:{ issuer:custom,customer:{ name:'Client' } } }
    const enabled = changeIssuerSource(original,true,profile)
    expect(enabled.doc.issuer).toEqual(profile)
    const disabled = changeIssuerSource(enabled,false,profile)
    expect(disabled.doc.issuer).toEqual(custom)
    disabled.doc.issuer.name = 'Changed'
    expect(profile.name).toBe('Company')
    expect(original.doc.issuer.name).toBe('Other issuer')
    expect(disabled.doc.customer).toEqual(original.doc.customer)
  })
  it('uses separate lifecycles for quotes and invoices', () => {
    expect(documentStatuses('quote')).toContain('accepted')
    expect(documentStatuses('quote')).toContain('invoiced')
    expect(documentStatuses('invoice')).not.toContain('accepted')
    expect(documentStatuses('invoice')).toContain('paid')
  })
})
