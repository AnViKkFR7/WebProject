import { describe, it, expect } from 'vitest'
import { invoiceTotals, validInvoice, newLine, createRectificationDocument } from './invoicing'
describe('invoice calculations', () => {
  it('rounds discounted lines and taxes before withholding', () => {
    expect(invoiceTotals([{ quantity:2,price:100,discount:10,tax:21 },{ quantity:1,price:50,discount:0,tax:10 }],15)).toMatchObject({ base:230,tax:42.8,retained:34.5,total:238.3 })
  })
  it('keeps cents stable and supports exempt lines', () => {
    expect(invoiceTotals([{ quantity:3,price:.1,discount:0,tax:0 }]).total).toBe(.3)
  })
  it('supports signed correction lines and builds a corrective copy without mutating the original',()=>{
    const original={id:'i-1',number:'F-1',document:{issuer:{name:'Issuer',taxId:'123',address:'Street'},customer:{name:'Client',taxId:'456',address:'Road'},date:'2026-10-22',dueDate:'',withholding:0,lines:[{description:'Service',quantity:1,price:100,discount:0,tax:21}]}}
    const difference=createRectificationDocument(original,'difference','other','Credit', '2026-10-24')
    expect(invoiceTotals(difference.lines,0).total).toBe(-121)
    expect(validInvoice(difference)).toBe(true)
    const replacement=createRectificationDocument(original,'substitution','other','Correction','2026-10-24')
    expect(invoiceTotals(replacement.lines,0).total).toBe(121)
    expect(replacement.rectification.originalTotal).toBe(121)
    expect(original.document.lines[0]).not.toHaveProperty('sign')
  })
  it('rejects incomplete billing details, dates and invalid quantities', () => {
    const doc = { issuer:{ name:'Issuer',taxId:'123',address:'Street' },customer:{ name:'Client',taxId:'456',address:'Road' },date:'2026-10-22',dueDate:'',withholding:0,lines:[{ ...newLine(),description:'Service',price:100 }] }
    expect(validInvoice(doc)).toBe(true)
    expect(validInvoice({ ...doc,dueDate:'2026-10-21' })).toBe(false)
    expect(validInvoice({ ...doc,lines:[{ ...doc.lines[0],quantity:0 }] })).toBe(false)
    expect(validInvoice({ ...doc,lines:[{ ...doc.lines[0],price:'NaN' }] })).toBe(false)
    expect(validInvoice({ ...doc,customer:{ ...doc.customer,taxId:'' } })).toBe(false)
  })
})
