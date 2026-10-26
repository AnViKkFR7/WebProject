import { jsPDF } from 'jspdf'
import { invoiceTotals } from './invoicing'
import { contrastRatio, documentPalette, validBillingPalette } from './billingAppearance'

// Shared renderer: preview and download use exactly the same PDF and pagination.
export function createDocumentPdf(invoice, t, language = 'es', kind = 'invoice') {
  const doc = invoice.document
  const pdf = new jsPDF({ unit:'mm',format:'a4' })
  const previewPages = [[]]
  let previewPage = 0
  const record = item => previewPages[previewPage].push(item)
  const quote = kind === 'quote'
  const es = language.startsWith('es')
  const word = (spanish,english) => es ? spanish : english
  const label = key => {
    const quoteKey = `quotes.${key}`
    const keyName = quote && t(quoteKey) !== quoteKey ? quoteKey : `invoicing.${key}`
    return t(keyName)
  }
  const money = value => new Intl.NumberFormat(language,{ style:'currency',currency:'EUR' }).format(value)
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : (value || '')
  const totals = invoiceTotals(doc.lines,doc.withholding)
  const palette=documentPalette(doc.issuer)
  const branded=validBillingPalette(doc.issuer.palette)
  const ink=branded ? palette.ink : '#172326'
  const surface=branded ? palette.surface : '#f3f4f5'
  const brandColor = /^#[0-9a-f]{6}$/i.test(doc.issuer.color || '') ? doc.issuer.color : (quote ? '#175b55' : '#111111')
  const accent = branded ? palette.accent : '#20252b'
  // Custom accents are validated on paper; table surfaces can need the main ink instead.
  const surfaceAccent = branded && contrastRatio(accent,surface)<4.5 ? ink : accent
  const gray = palette.muted
  const pageLeft = 14
  const pageRight = 196
  const contentWidth = pageRight-pageLeft
  const cellLeft = pageLeft+3
  let y = 0
  const font = (size=9,bold=false,color=ink) => { pdf.setFont('helvetica',bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(color) }
  const text = (value,x,at,size=9,bold=false,color=ink,align='left') => { font(size,bold,color); pdf.text(String(value || ''),x,at,{ align }); record({ type:'text',value:String(value || ''),x,y:at,size:size/2.83464567,bold,color,align }) }
  const amount = (value,x,at,size=9,bold=false,color=accent,width=22) => { font(size,bold); text(value,x,at,Math.min(size,size*width/Math.max(pdf.getTextWidth(value),width)),bold,color,'right') }
  const rule = (at,color='#dce1e1') => { pdf.setDrawColor(color); pdf.setLineWidth(.25); pdf.line(pageLeft,at,pageRight,at); record({ type:'line',x1:pageLeft,y1:at,x2:pageRight,y2:at,color }) }
  const fill = (x,at,w,h,color) => { pdf.setFillColor(color); pdf.rect(x,at,w,h,'F'); record({ type:'rect',x,y:at,width:w,height:h,fill:color }) }
  const wrap = (value,width,size=9,bold=false) => { font(size,bold); return pdf.splitTextToSize(String(value || ''),width) }
  const logo = (x,at,w,h) => {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(doc.issuer.logo || '')) return false
    let image
    try { image=pdf.getImageProperties(doc.issuer.logo) } catch { return false }
    if(!Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width<=0 || image.height<=0) return false
    const scale = Math.min(w/image.width,h/image.height)
    pdf.addImage(doc.issuer.logo,image.fileType,x+(w-image.width*scale)/2,at+(h-image.height*scale)/2,image.width*scale,image.height*scale)
    record({ type:'image',href:doc.issuer.logo,x:x+(w-image.width*scale)/2,y:at+(h-image.height*scale)/2,width:image.width*scale,height:image.height*scale })
    return true
  }
  const quoteBand = () => {
    const hasLogo = logo(pageLeft,8,17,15)
    const title = wrap(doc.issuer.name,hasLogo ? 105 : 120,12,true).slice(0,2)
    title.forEach((line,i) => text(line,hasLogo ? 36 : pageLeft,13+i*5,12,true,accent))
    const contact = [doc.issuer.phone,doc.issuer.email].filter(Boolean).flatMap(value => wrap(value,47,7)).slice(0,3)
    contact.forEach((line,i) => text(line,pageRight,10+i*4,7,false,gray,'right'))
    fill(pageLeft,25,contentWidth,.5,branded ? palette.accent : brandColor)
    y=31
  }
  const newPage = () => { pdf.addPage(); previewPages.push([]); previewPage=previewPages.length-1; if(branded) fill(0,0,210,297,palette.paper); if (quote) quoteBand(); else { text(`${word('Factura','Invoice')} · ${invoice.number}`,14,17,11,true); rule(23); y=31 } }
  const ensure = height => { if (y+height>271) newPage() }
  const flow = (value,width=182,size=9,bold=false,color=ink,x=14,leading=4.8) => {
    for (const line of wrap(value,width,size,bold)) { ensure(leading); text(line,x,y,size,bold,color); y+=leading }
  }
  const space = amount => { y+=amount }
  const heading = value => { ensure(16); flow(value,182,14,true,accent); space(3) }
  const totalsBlock = () => {
    const taxRates = [...new Set(doc.lines.map(line => Number(line.tax)))].sort((a,b) => a-b)
    const rows = []
    const reduction=totals.rows.reduce((sum,row)=>sum+Math.round(row.discount*100),0)/100
    if(reduction) rows.push([word('ANTES DEL DESCUENTO','BEFORE DISCOUNT'),totals.rows.reduce((sum,row)=>sum+Math.round(row.original*100),0)/100],[word('DESCUENTO','DISCOUNT'),-reduction])
    rows.push([word('BASE IMPONIBLE','TAXABLE BASE'),totals.base])
    taxRates.forEach(rate => { rows.push([`${word('IVA','VAT')} (${rate}%)`,Math.round(totals.rows.reduce((sum,row,index) => sum+(Number(doc.lines[index].tax)===rate ? Math.round(row.tax*100) : 0),0))/100]) })
    if (Number(doc.withholding)) rows.push([`${word('RETENCIÓN','WITHHOLDING')} (${doc.withholding}%)`,-totals.retained])
    rows.push([word('TOTAL','TOTAL'),totals.total])
    ensure(Math.min(rows.length*7+20,220)); rule(y); space(9)
    const placement={page:pdf.getNumberOfPages(),top:y}
    rows.forEach(([name,amount],i) => { ensure(8); text(name,132,y,7,i===rows.length-1,accent); text(money(amount),196,y,9,i===rows.length-1,accent,'right'); space(7) })
    rule(y); space(11)
    return placement
  }
  const paymentNotes = (width=182) => {
    for (const [key,title] of [['payment',word('FORMA DE PAGO','PAYMENT METHOD')],['iban','IBAN'],['notes',word('NOTAS','NOTES')]]) {
      if (doc[key]) { ensure(12); flow(title,width,7,true,accent,14,3.8); flow(doc[key],width,8,false,gray,14,4); space(3) }
    }
  }

  if(branded) fill(0,0,210,297,palette.paper)
  if (!quote) {
    // Reference: generous white header, compact issuer details and a right-aligned document identity.
    const hasLogo = logo(pageLeft,18,25,22)
    const issuerX = hasLogo ? 49 : pageLeft
    y=25
    const issuerLines = wrap(doc.issuer.name,94,17)
    issuerLines.forEach(line => { ensure(7); text(line,issuerX,y,17); y+=7 })
    ;['taxId','address','phone','email'].forEach(key => { if (doc.issuer[key]) flow(doc.issuer[key],92,7,false,gray,issuerX,4) })
    text(doc.rectification ? word('Factura rectificativa','Corrective invoice') : word('Factura','Invoice'),pageRight,25,20,false,branded ? accent : '#111111','right')
    const metadata = [[word('NÚMERO #','NUMBER #'),invoice.number],[word('FECHA','DATE'),date(doc.date)],[word('VENCIMIENTO','DUE DATE'),date(doc.dueDate)],[word('ESTADO','STATUS'),label(invoice.status)]]
    let metaY=34
    metadata.forEach(([name,value]) => { text(name,141,metaY,6.5,true); for (const part of wrap(value,27,7)) { text(part,pageRight,metaY,7,false,gray,'right'); metaY+=4 }; metaY+=1 })
    y=Math.max(y+4,metaY+4,61); rule(y); space(10)
    const customerLabelY=y
    text(word('CLIENTE','CLIENT'),pageLeft,customerLabelY,7,true)
    text(word('TOTAL','TOTAL'),pageRight,customerLabelY,7,true,branded ? accent : '#111111','right')
    const totalY=customerLabelY+12
    text(money(totals.total),pageRight,totalY,19,false,branded ? accent : '#111111','right')
    const customerLines=[]
    ;['name','address','taxId','email'].forEach(key => {
      if(doc.customer[key]) wrap(doc.customer[key],113,8,key==='name').forEach(line=>customerLines.push({line,bold:key==='name'}))
    })
    let customerY=customerLabelY+8
    customerLines.forEach(({line,bold})=>{text(line,pageLeft,customerY,8,bold,gray);customerY+=4.8})
    y=Math.max(customerY,totalY+4)+5
    rule(y);space(10)
    if (doc.rectification) {
      flow(`${word('FACTURA RECTIFICATIVA DE','CORRECTIVE INVOICE FOR')} ${doc.rectification.originalNumber}`,182,8,true,accent);space(2)
      const causeLabels={required_data:['Falta de datos obligatorios','Missing required details'],incorrect_tax:['Impuesto calculado incorrectamente','Incorrectly calculated tax'],article_80:['Supuesto del artículo 80 de la Ley del IVA','Case under Article 80 of the VAT Act'],other:['Otra causa','Other reason']}
      const cause=causeLabels[doc.rectification.cause] || [doc.rectification.cause,doc.rectification.cause]
      flow(`${word('CAUSA','REASON')}: ${word(...cause)}${doc.rectification.note ? ` · ${doc.rectification.note}` : ''}`,182,7,false,gray);space(2)
      const correctionAmount=doc.rectification.method==='difference' ? totals.total : totals.total-Number(doc.rectification.originalTotal || 0)
      flow(`${word('MÉTODO','METHOD')}: ${word(doc.rectification.method==='difference'?'Por diferencias':'Por sustitución',doc.rectification.method==='difference'?'By difference':'By substitution')}`,182,7,false,gray)
      flow(`${word('IMPORTE DE RECTIFICACIÓN','CORRECTION AMOUNT')}: ${money(correctionAmount)}`,182,8,true,accent);space(4)
    }
    const tableHead = () => {
      ensure(18)
      const cols = [[word('CONCEPTO','DESCRIPTION'),pageLeft],[word('PRECIO','PRICE'),125],[word('UNIDADES','UNITS'),146],[word('ANTES DTO.','BEFORE DISC.'),172],[word('DESPUÉS DTO.','AFTER DISC.'),193]]
      cols.forEach(([name,x],i) => text(name,x,y,6.5,true,branded ? accent : '#111111',i ? 'right' : 'left')); space(6)
    }
    tableHead()
    doc.lines.forEach((line,index) => {
      const description = [...(line.chapter ? [line.chapter] : []),line.description]
      if (line.details) description.push(line.details)
      if(Number(line.discount)) description.push(`${word('Descuento','Discount')} ${line.discount}%: -${money(totals.rows[index].discount)}`)
      if (new Set(doc.lines.map(row => Number(row.tax))).size > 1) description.push(`${word('IVA','VAT')}: ${line.tax}%`)
      let fragments = wrap(description.join('\n'),85,8)
      let first=true
      while (fragments.length) {
        if (y+13>271) { newPage(); tableHead() }
        const count = Math.max(1,Math.floor((271-y-5)/4))
        const chunk = fragments.splice(0,count)
        const height = Math.max(10,chunk.length*4+5)
        fill(pageLeft,y,contentWidth,height,branded ? surface : '#eeeeee')
        chunk.forEach((part,i) => text(part,cellLeft,y+5+i*4,8,false,branded ? ink : '#202629'))
        if (first) {
          amount(money(line.price),125,y+5,8,false,gray,22); text(line.sign===-1?`−${line.quantity}`:String(line.quantity),146,y+5,8,false,gray,'right')
          amount(money(totals.rows[index].original),172,y+5,8,false,gray,22); amount(money(totals.rows[index].base),193,y+5,8,true,ink,19)
        }
        y+=height+1.2; first=false
      }
    })
    space(3); flow(word('Importes de las partidas antes y después del descuento, sin IVA.','Line amounts before and after discount, excluding VAT.'),182,7,false,gray); space(4)
    const placement=totalsBlock()
    const bottom=y
    const notesHeight=['payment','iban','notes'].reduce((height,key)=>height+(doc[key] ? 6.8+wrap(doc[key],100,8).length*4 : 0),0)
    if(branded && placement.page===pdf.getNumberOfPages() && placement.top+notesHeight+12<=271 && notesHeight<=bottom-placement.top-10) {
      y=placement.top;paymentNotes(100);y=Math.max(y,bottom)
    } else paymentNotes()
  } else {
    quoteBand()
    const presentation = doc.presentation || {}
    flow(word('PROPUESTA DE TRABAJOS','WORK PROPOSAL'),182,9,true,accent); space(3)
    flow(presentation.title || word('Presupuesto de trabajos','Work quotation'),160,24,true,accent,14,10)
    space(2)
    if (presentation.site) { flow(presentation.site,182,11,false,gray); space(4) }
    flow(`${invoice.number} · ${date(doc.date)} · ${label(invoice.status)}`,182,8,false,gray)
    if (doc.dueDate) flow(`${word('Válido hasta','Valid until')}: ${date(doc.dueDate)}`,182,8,false,gray)
    space(7)
    if (presentation.introduction) { flow(presentation.introduction,182,10,false,gray,14,5.5); space(7) }
    ensure(40)
    text(word('EMPRESA','COMPANY'),14,y,7,true,accent); text(word('CLIENTE / OBRA','CLIENT / SITE'),112,y,7,true,accent); space(6)
    const left = [doc.issuer.name,doc.issuer.taxId,doc.issuer.address].filter(Boolean).flatMap(value => wrap(value,85,9))
    const right = [doc.customer.name,doc.customer.taxId,doc.customer.address,doc.customer.email].filter(Boolean).flatMap(value => wrap(value,84,9))
    for (let i=0;i<Math.max(left.length,right.length);i++) {
      ensure(5); text(left[i],14,y,9); text(right[i],112,y,9); y+=5
    }
    space(10)
    // Chapters preserve the user's codes and first-appearance order. Legacy flat quotes form one chapter.
    const groups = new Map()
    doc.lines.forEach((line,index) => {
      const chapter = line.chapter?.trim() || word('Trabajos incluidos','Included work')
      if (!groups.has(chapter)) groups.set(chapter,[])
      groups.get(chapter).push({ line,index })
    })
    const chapterAmount = rows => rows.reduce((sum,{index}) => sum+Math.round(totals.rows[index].base*100),0)/100
    const summaryHead = () => { ensure(17); fill(14,y,182,10,surface); text(word('TRABAJOS INCLUIDOS','INCLUDED WORK'),17,y+6.5,8,true,surfaceAccent); text(word('IMPORTE','AMOUNT'),193,y+6.5,8,true,surfaceAccent,'right'); y+=10 }
    summaryHead()
    for (const [chapter,rows] of groups) {
      const lines = wrap(chapter,140,10,true)
      for (let i=0;i<lines.length;i++) { if (y+7>271) { newPage(); summaryHead() }; text(lines[i],17,y+5.5,10,true); if(i===0) text(money(chapterAmount(rows)),193,y+5.5,10,true,accent,'right'); y+=7 }
      rule(y); space(1.8)
    }
    space(7)
    const summaryRows = []
    const reduction=totals.rows.reduce((sum,row)=>sum+Math.round(row.discount*100),0)/100
    if(reduction) summaryRows.push([word('Antes del descuento','Before discount'),totals.rows.reduce((sum,row)=>sum+Math.round(row.original*100),0)/100],[word('Descuento','Discount'),-reduction])
    summaryRows.push([word('Base imponible','Taxable base'),totals.base],[word('IVA','VAT'),totals.tax])
    if (Number(doc.withholding)) summaryRows.push([`${word('Retención','Withholding')} (${doc.withholding}%)`,-totals.retained])
    const summaryHeight = Math.max(26,summaryRows.length*6+10)
    const pageBeforeSummary=pdf.getNumberOfPages()
    ensure(summaryHeight+2); fill(14,y,182,summaryHeight,surface)
    text(money(totals.total),19,y+12,20,true,surfaceAccent)
    text(word('TOTAL PRESUPUESTO','QUOTATION TOTAL'),19,y+20,7,true,surfaceAccent)
    summaryRows.forEach(([name,amount],index) => { text(name,132,y+8+index*6,8,false,gray); text(money(amount),193,y+8+index*6,9,true,surfaceAccent,'right') })
    y+=summaryHeight+6
    if(pdf.getNumberOfPages()===pageBeforeSummary)newPage();else space(8)
    heading(word('Detalle de trabajos incluidos','Included work details'))
    for (const [chapter,rows] of groups) {
      ensure(30)
      const chapterTitle = wrap(chapter,172,12,true)
      for (const part of chapterTitle) { ensure(9); fill(14,y,182,9,surface); text(part,18,y+6,11,true,surfaceAccent); y+=9 }
      space(4)
      for (const {line,index} of rows) {
        ensure(15)
        const parts = wrap(line.description,140,10,true)
        parts.forEach((part,i) => { ensure(6); text(part,17,y,10,true); if(i===0) text(money(totals.rows[index].base),193,y,10,true,accent,'right'); y+=5.5 })
        flow(`${line.quantity} × ${money(line.price)}${Number(line.discount) ? ` · ${word('Dto.','Discount')} ${line.discount}%` : ''} · ${word('IVA','VAT')} ${line.tax}%`,174,8,false,gray,17)
        if(Number(line.discount)) {
          flow(`${word('Antes del descuento','Before discount')}: ${money(totals.rows[index].original)} · ${word('Descuento','Discount')} ${line.discount}%: -${money(totals.rows[index].discount)}`,174,8,false,gray,17)
          flow(`${word('Después del descuento (sin IVA)','After discount (before VAT)')}: ${money(totals.rows[index].base)}`,174,9,true,accent,17)
        }
        if (line.details) flow(line.details,174,9,false,gray,17)
        space(2); rule(y); space(4)
      }
      ensure(12); text(word('TOTAL CAPÍTULO','CHAPTER TOTAL'),17,y,8,true,accent); text(money(chapterAmount(rows)),193,y,10,true,accent,'right'); space(9)
    }
    if (presentation.conditions) { heading(word('Condiciones y exclusiones','Conditions and exclusions')); flow(presentation.conditions,182,9,false,gray); space(7) }
    paymentNotes()
    if (presentation.signatures !== false) {
      ensure(39); space(4)
      for (const [x,name] of [[14,doc.issuer.name],[111,doc.customer.name]]) {
        pdf.setDrawColor('#dce1e1'); pdf.rect(x,y,85,30); record({ type:'rect',x,y,width:85,height:30,fill:'none',stroke:'#dce1e1' })
        text(word('CONFORMIDAD','ACCEPTANCE'),x+4,y+6,7,true,accent)
        wrap(name,77,8).slice(0,2).forEach((part,i) => text(part,x+4,y+11+i*4,8))
        text(word('Firma y fecha:','Signature and date:'),x+4,y+26,7,false,gray)
      }
      y+=34
    }
  }
  const pages=pdf.getNumberOfPages()
  for (let page=1;page<=pages;page++) {
    pdf.setPage(page); previewPage=page-1; rule(282)
    const reference = `${invoice.number} · ${money(totals.total)}${doc.dueDate ? ` · ${date(doc.dueDate)}` : ''}`
    text(reference,14,288,6,false,gray)
    text(`${word('Pág.','Page')} ${page} ${word('de','of')} ${pages}`,196,288,6,false,gray,'right')
  }
  pdf.setProperties({ title:`${word(quote ? 'Presupuesto' : 'Factura',quote ? 'Quotation' : 'Invoice')} ${invoice.number}`,author:doc.issuer.name })
  pdf.previewPages=previewPages
  return pdf
}

// Keep creation and the anchor click synchronous: browser download permissions
// can be lost if a dynamic import is awaited after the user's click.
export function downloadInvoice(invoice,t,language,kind='invoice') {
  const pdf=createDocumentPdf(invoice,t,language,kind)
  const blob=pdf.output('blob')
  const filename=`${invoice.number.replace(/[^a-z0-9_-]/gi,'_')}.pdf`
  const url=URL.createObjectURL(blob)
  const anchor=document.createElement('a')
  anchor.href=url;anchor.download=filename;anchor.style.display='none'
  document.body.append(anchor)
  try { anchor.click() } finally { anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000) }
  return {blob,filename}
}
