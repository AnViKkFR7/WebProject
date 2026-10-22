import {describe,it,expect} from 'vitest'
import {billingPalettes,contrastRatio,documentPalette,selectBillingPalette,validBillingPalette,withBillingAppearance} from './billingAppearance'
import {validBillingProfile,changeIssuerSource} from './invoicing'
const profile={name:'Company',taxId:'A',address:'Madrid',color:'#e11d48',logo:''}
describe('billing appearance contracts',()=>{
  it('provides three readable palettes and exact WCAG contrast calculations',()=>{
    expect(contrastRatio('#000000','#ffffff')).toBe(21)
    expect(contrastRatio('#ffffff','#ffffff')).toBe(1)
    expect(billingPalettes).toHaveLength(3)
    billingPalettes.forEach(palette=>expect(validBillingPalette(palette)).toBe(true))
  })
  it('rejects incomplete, unsafe and low-contrast palette roles',()=>{
    for (const palette of [null,[],{}, {...billingPalettes[0],id:'unknown'}, {...billingPalettes[0],ink:'#ffffff'}, {...billingPalettes[0],muted:'#eeeeee'}, {...billingPalettes[0],accent:'#ffffff'}, {...billingPalettes[0],paper:'url(https://example.com)'}, {...billingPalettes[0],extra:true}]) {
      expect(validBillingPalette(palette)).toBe(false)
      expect(validBillingProfile({...profile,palette})).toBe(false)
    }
  })
  it('preserves legacy designs and never mutates company defaults or saved snapshots',()=>{
    expect(documentPalette(profile)).toMatchObject({id:'legacy',accent:'#e11d48',surface:'#f3f4f5'})
    const first=selectBillingPalette(profile,billingPalettes[1])
    const saved=structuredClone(first)
    const second=withBillingAppearance(profile,selectBillingPalette(profile,billingPalettes[2]))
    expect(saved.palette).toEqual(billingPalettes[1])
    expect(second.palette).toEqual(billingPalettes[2])
    second.palette.ink='#000000'
    expect(billingPalettes[2].ink).not.toBe('#000000')
    expect(profile).not.toHaveProperty('palette')
    expect(withBillingAppearance(saved,profile)).not.toHaveProperty('palette')
  })
  it('keeps document branding independent when changing the fiscal issuer source',()=>{
    const custom=selectBillingPalette({...profile,name:'Custom',logo:'custom-logo'},billingPalettes[2])
    const editor={doc:{issuer:custom},useCompanyIssuer:false}
    const switched=changeIssuerSource(editor,true,profile)
    expect(switched.doc.issuer.name).toBe('Company')
    expect(switched.doc.issuer.logo).toBe('custom-logo')
    expect(switched.doc.issuer.palette).toEqual(billingPalettes[2])
    expect(changeIssuerSource(switched,false,profile).doc.issuer.name).toBe('Custom')
  })
})
