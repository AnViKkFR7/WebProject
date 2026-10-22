const fs=require('node:fs')
const esbuild=require('esbuild')
esbuild.buildSync({entryPoints:['src/lib/invoicingPdf.js'],bundle:true,platform:'node',format:'cjs',external:['jspdf'],outfile:'.design-preview/pdf.cjs'})
esbuild.buildSync({entryPoints:['.design-preview/mocks.jsx'],bundle:true,platform:'node',format:'cjs',outfile:'.design-preview/fixture.cjs'})
esbuild.buildSync({entryPoints:['src/locales/es.js'],bundle:true,platform:'node',format:'cjs',outfile:'.design-preview/labels.cjs'})
const {createDocumentPdf}=require('./pdf.cjs')
const {exampleDocument}=require('./fixture.cjs')
const {es}=require('./labels.cjs')
const t=key=>key.split('.').reduce((value,k)=>value?.[k],es)||key
for(const kind of ['invoice','quote']) {
  const pdf=createDocumentPdf({number:kind==='quote'?'P260001':'F260001',status:'draft',document:exampleDocument},t,'es',kind)
  const filename='../output/pdf/'+(kind==='quote'?'presupuesto-identidad.pdf':'factura-identidad.pdf')
  fs.writeFileSync(filename,Buffer.from(pdf.output('arraybuffer')))
  console.log(filename+': '+pdf.getNumberOfPages()+' pages')
}
