import { describe, it, expect } from 'vitest'
import { createDocumentPdf } from './invoicingPdf'
import { billingPalettes } from './billingAppearance'
import {readFileSync} from 'node:fs'
describe('invoice PDF', () => {
  it.each(['invoice','quote'])('preserves a company logo aspect ratio in the %s PDF and preview',kind=>{
    const logo='data:image/png;base64,'+readFileSync(new URL('../../tests/fixtures/billing-logo.png',import.meta.url)).toString('base64')
    const document={issuer:{name:'Company',taxId:'A',address:'Madrid',palette:billingPalettes[0],logo},customer:{name:'Client',taxId:'B',address:'Barcelona'},date:'2026-10-22',withholding:0,lines:[{description:'Service',quantity:1,price:100,discount:0,tax:21}]}
    const pdf=createDocumentPdf({number:'F0001',status:'draft',document},key=>key,'es',kind)
    const images=pdf.previewPages.flat().filter(item=>item.type==='image')
    expect(images.length).toBeGreaterThan(0)
    images.forEach(image=>{expect(image.href).toBe(logo);expect(image.width/image.height).toBeCloseTo(640/180,5)})
  })
  it.each(['invoice','quote'])('uses all palette roles consistently in %s preview and PDF output',kind=>{
    const palette={...billingPalettes[1],id:'custom',paper:'#fffdf5',surface:'#edf3f8'}
    const document={issuer:{name:'Company',taxId:'A',address:'Madrid',palette,color:palette.accent},customer:{name:'Client',taxId:'B',address:'Barcelona'},date:'2026-10-22',withholding:0,lines:[{description:'Service',quantity:1,price:100,discount:10,tax:21}]}
    const pdf=createDocumentPdf({number:'F0001',status:'draft',document},key=>key,'es',kind)
    const commands=pdf.previewPages.flat()
    expect(commands.some(item=>item.type==='rect' && item.width===210 && item.fill===palette.paper)).toBe(true)
    expect(commands.some(item=>item.type==='rect' && item.fill===palette.surface)).toBe(true)
    for(const role of ['ink','muted','accent']) expect(commands.some(item=>item.type==='text' && item.color===palette[role])).toBe(true)
    expect(pdf.output()).toContain('%PDF-1.3')
  })
  it('creates a downloadable multipage PDF with escaped filenames', async () => {
    const invoice = { number:'F/000001',status:'draft',document:{
      issuer:{ name:'Marca',taxId:'123',address:'Madrid',color:'#635bff' },
      customer:{ name:'Cliente',taxId:'456',address:'Barcelona' },date:'2026-10-22',withholding:0,
      lines:Array.from({ length:60 },(_,i) => ({ description:`Servicio ${i}`,quantity:1,price:100,discount:0,tax:21 })),
    } }
    const output=createDocumentPdf(invoice,key=>key,'es').output()
    expect(output).toContain('%PDF-1.3')
    expect(output).toContain('Servicio 59')
    expect(output.match(/\/Type \/Page\b/g).length).toBeGreaterThan(1)
  })
  it('uses quote titles and statuses in quote PDFs', async () => {
    const invoice = { number:'P-000001',status:'accepted',document:{
      issuer:{ name:'Marca',taxId:'123',address:'Madrid',color:'#635bff' },
      customer:{ name:'Cliente',taxId:'456',address:'Barcelona' },date:'2026-10-22',withholding:0,
      lines:[{ description:'Servicio',quantity:1,price:100,discount:0,tax:21 }],
    } }
    const labels = { 'quotes.title':'Presupuestos','quotes.accepted':'Aceptado' }
    const output=createDocumentPdf(invoice,key => labels[key] || key,'es','quote').output()
    expect(output).toContain('PROPUESTA DE TRABAJOS')
    expect(output).toContain('Aceptado')
  })

  it('shares all pages with the preview, keeps chapter codes and renders hostile text as plain text', () => {
    const invoice={ number:'P260002',status:'draft',document:{
      issuer:{name:'Company',taxId:'123',address:'Madrid',color:'#ffffff'},customer:{name:'Client',taxId:'456',address:'Barcelona'},date:'2026-10-22',withholding:15,
      presentation:{ title:'Reforma',conditions:'Conditions '.repeat(150),signatures:true },
      lines:Array.from({length:20},(_,i)=>({ description:`Work ${i} <script>alert(1)</script>`,chapter:i<10?'01 · Preparación':'07 · Acabados',details:'Details '.repeat(180),quantity:2,price:100,discount:10,tax:i%2?21:10 })),
    } }
    const pdf=createDocumentPdf(invoice,key=>key,'es','quote')
    expect(pdf.previewPages).toHaveLength(pdf.getNumberOfPages())
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2)
    const commands=pdf.previewPages.flat()
    expect(commands.some(c=>c.type==='text' && c.value==='07 · Acabados')).toBe(true)
    expect(commands.some(c=>c.type==='text' && c.value.includes('<script>'))).toBe(true)
    for(const [page,items] of pdf.previewPages.entries()) {
      expect(items.some(c=>c.type==='text' && c.value==='Company')).toBe(true)
      expect(items.some(c=>c.type==='text' && c.value===`Pág. ${page+1} de ${pdf.getNumberOfPages()}`)).toBe(true)
      for(const item of items) {
        if(item.type==='text') { expect(item.y).toBeGreaterThan(0); expect(item.y).toBeLessThanOrEqual(288) }
        if(item.type==='rect') expect(item.y+item.height).toBeLessThan(282)
      }
    }
  })
  it.each(['invoice','quote'])('shows exact before/discount/after values in a neutral %s PDF',kind=>{
    const doc={issuer:{name:'Company',taxId:'A',address:'Madrid',color:'#e11d48'},customer:{name:'Client',taxId:'B',address:'Madrid'},date:'2026-10-22',withholding:0,lines:[{chapter:'01 · Work',description:'Service',quantity:2,price:100,discount:10,tax:21}]}
    const pdf=createDocumentPdf({number:'F0001',status:'draft',document:doc},key=>key,'es',kind)
    const commands=pdf.previewPages.flat()
    const text=commands.filter(item=>item.type==='text').map(item=>item.value).join(' ').replace(/\s/g,' ')
    expect(text).toContain('200,00 €')
    expect(text).toContain('20,00 €')
    expect(text).toContain('180,00 €')
    expect(text).toContain('217,80 €')
    expect(text).toContain(kind==='quote' ? 'Después del descuento (sin IVA)' : 'DESPUÉS DTO.')
    expect(commands.filter(item=>item.type==='rect' && item.fill==='#e11d48' && item.height>1)).toHaveLength(0)
  })

})
