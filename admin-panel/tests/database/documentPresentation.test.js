import { beforeAll, afterAll, it, expect } from 'vitest'
import { database, login, sqlFile, save, document, ids } from './helpers'
let db
beforeAll(async()=>{
  db=await database()
  await db.exec(await sqlFile('migrations/BILLING_SECURITY_HARDENING.sql'))
  await db.exec(await sqlFile('migrations/BILLING_DOCUMENT_PRESENTATION.sql'))
  await login(db)
},30000)
afterAll(async()=>{ await db?.close() })
it('keeps legacy documents valid and persists optional quote presentation through conversion',async()=>{
  await expect(save(db)).resolves.toBeTruthy()
  const doc=document()
  doc.presentation={ title:'Vivienda',site:'Madrid',introduction:'Alcance',conditions:'Exclusiones',signatures:true }
  doc.lines[0].chapter='07 · Pintura';doc.lines[0].details='Preparación y dos manos.'
  const quote=await save(db,ids.a,doc,'accepted','quote')
  expect(quote.document).toEqual(doc)
  const converted=(await db.query('select * from public.convert_quote_to_invoice($1,$2,$3)',[ids.a,quote.id,quote.version])).rows[0]
  const invoice=(await db.query('select document from public.invoices where id=$1',[converted.invoice_id])).rows[0]
  expect(invoice.document.presentation).toEqual(doc.presentation)
  expect(invoice.document.lines).toEqual(doc.lines)
})
it('rejects malformed optional fields at the SQL boundary',async()=>{
  for (const presentation of [null,[],{ title:{} },{ conditions:'x'.repeat(2001) },{ signatures:'true' }]) {
    await expect(save(db,ids.a,{ ...document(),presentation },'draft','quote')).rejects.toThrow()
  }
  for (const fields of [{chapter:[]},{chapter:'x'.repeat(201)},{details:{html:'unsafe'}}]) {
    const doc=document();Object.assign(doc.lines[0],fields)
    await expect(save(db,ids.a,doc,'draft','quote')).rejects.toThrow()
  }
})
