import { describe, it, expect } from 'vitest'
import { createDocumentPdf } from './invoicingPdf'
import { billingPalettes, contrastRatio, validBillingPalette } from './billingAppearance'
import {readFileSync} from 'node:fs'
describe('invoice PDF', () => {
  it('keeps custom quote text readable on table surfaces without changing the saved palette',()=>{
    const palette={id:'custom',accent:'#767676',ink:'#000000',muted:'#000000',paper:'#ffffff',surface:'#767676'}
    expect(validBillingPalette(palette)).toBe(true)
    const document={issuer:{name:'Company',taxId:'A',address:'Madrid',palette},customer:{name:'Client',taxId:'B',address:'Barcelona'},date:'2026-10-24',withholding:0,lines:[{chapter:'01 · Work',description:'Service',quantity:1,price:100,discount:0,tax:21}]}
    const pdf=createDocumentPdf({number:'P0001',status:'draft',document},key=>key,'es','quote')
    let checked=0
    for(const page of pdf.previewPages) {
      const surfaces=page.filter(item=>item.type==='rect' && item.fill===palette.surface)
      for(const item of page.filter(item=>item.type==='text')) {
        if(surfaces.some(rect=>item.x>=rect.x && item.x<=rect.x+rect.width && item.y>rect.y && item.y<=rect.y+rect.height)) {
          expect(contrastRatio(item.color,palette.surface)).toBeGreaterThanOrEqual(4.5)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(5)
    expect(pdf.previewPages.flat().find(item=>item.type==='text' && item.value==='Company').color).toBe(palette.accent)
    expect(document.issuer.palette.accent).toBe('#767676')
  })

  it.each(['invoice','quote'])('renders a corrupt legacy logo with the same fallback as no logo (%s)',kind=>{
    const document={issuer:{name:'Company',taxId:'A',address:'Madrid',logo:'data:image/png;base64,iVBORw0KGgo='},customer:{name:'Client',taxId:'B',address:'Barcelona'},date:'2026-10-24',withholding:0,lines:[{description:'Service',quantity:1,price:100,discount:0,tax:21}]}
    const record={number:'F0001',status:'draft',document}
    const broken=createDocumentPdf(record,key=>key,'es',kind)
    const without=createDocumentPdf({...record,document:{...document,issuer:{...document.issuer,logo:''}}},key=>key,'es',kind)
    expect(broken.previewPages).toEqual(without.previewPages)
    expect(broken.previewPages.flat().some(item=>item.type==='text' && item.value==='Company')).toBe(true)
  })

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

  it('keeps invoice separators clear of text and aligns section labels to the page grid',()=>{
    const doc={issuer:{name:'Company',taxId:'A',address:'Madrid'},customer:{name:'',taxId:'',address:'',email:''},date:'2026-10-24',withholding:0,lines:[{description:'',quantity:1,price:0,discount:0,tax:21}]}
    const commands=createDocumentPdf({number:'F-BORRADOR',status:'draft',document:doc},key=>key,'es','invoice').previewPages[0]
    const texts=commands.filter(item=>item.type==='text')
    const client=texts.find(item=>item.value==='CLIENTE')
    const concept=texts.find(item=>item.value==='CONCEPTO')
    const totalAmount=texts.find(item=>item.value==='0,00 €' && item.size>6)
    const separator=commands.filter(item=>item.type==='line' && item.y1>client.y).sort((a,b)=>a.y1-b.y1)[0]
    expect(client.x).toBe(14)
    expect(concept.x).toBe(client.x)
    expect(separator.y1).toBeGreaterThan(totalAmount.y+4)
  })

  it.each(['invoice','quote'])('keeps horizontal separators outside text glyphs in the %s layout',kind=>{
    const doc={issuer:{name:'Company',taxId:'A',address:'Madrid'},customer:{name:'Cliente',taxId:'B',address:'Barcelona'},date:'2026-10-24',withholding:0,presentation:{title:'Proyecto'},lines:[{chapter:'01 · Inicio',description:'Servicio detallado',details:'Alcance del trabajo',quantity:1,price:100,discount:0,tax:21}]}
    const pages=createDocumentPdf({number:kind==='quote'?'P-1':'F-1',status:'draft',document:doc},key=>key,'es',kind).previewPages
    for(const page of pages) {
      const texts=page.filter(item=>item.type==='text')
      for(const line of page.filter(item=>item.type==='line')) {
        const crossed=texts.filter(item=>item.x>=line.x1 && item.x<=line.x2 && line.y1>item.y-item.size*.9 && line.y1<item.y+1)
        expect(crossed.map(item=>item.value)).toEqual([])
      }
    }
  })

})
