import {beforeAll,afterAll,it,expect} from 'vitest'
import {database,document,ids,login,profile,save,sqlFile} from './helpers'
import {billingPalettes,validBillingPalette} from '../../src/lib/billingAppearance'
import {readFile} from 'node:fs/promises'
let db
const saveProfile=(company,value,version)=>db.query('select public.save_invoice_profile($1,$2::jsonb,$3)',[company,JSON.stringify(value),version])
beforeAll(async()=>{
  db=await database()
  await db.exec(await sqlFile('migrations/BILLING_SECURITY_HARDENING.sql'))
  await db.exec(await sqlFile('migrations/BILLING_DOCUMENT_PRESENTATION.sql'))
  await db.exec(await sqlFile('migrations/BILLING_APPEARANCE.sql'))
  await login(db)
},30000)
afterAll(async()=>{await db?.close()})
it('persists palette snapshots without changing historical documents when company defaults change',async()=>{
  const before=await save(db)
  const doc=document();doc.issuer.palette=billingPalettes[1]
  const quote=await save(db,ids.a,doc,'accepted','quote')
  await saveProfile(ids.a,{...profile,palette:billingPalettes[2]},1)
  const saved=(await db.query('select document from public.quotes where id=$1',[quote.id])).rows[0].document
  expect(saved.issuer.palette).toEqual(billingPalettes[1])
  expect((await db.query('select document from public.invoices where id=$1',[before.id])).rows[0].document.issuer).not.toHaveProperty('palette')
  const converted=(await db.query('select * from public.convert_quote_to_invoice($1,$2,$3)',[ids.a,quote.id,quote.version])).rows[0]
  expect((await db.query('select document from public.invoices where id=$1',[converted.invoice_id])).rows[0].document.issuer.palette).toEqual(billingPalettes[1])
})
it('accepts all presets and custom palettes, with matching frontend and SQL contrast boundaries',async()=>{
  await login(db)
  for(const palette of [...billingPalettes,{...billingPalettes[0],id:'custom',accent:'#543d65'}]) {
    expect(validBillingPalette(palette)).toBe(true)
    const doc=document();doc.issuer.palette=palette
    expect((await save(db,ids.a,doc)).document.issuer.palette).toEqual(palette)
  }
  for(const muted of ['#767676','#777777','#ababab','#123456']) {
    const palette={...billingPalettes[0],id:'custom',surface:'#ffffff',muted}
    const doc=document();doc.issuer.palette=palette
    if(validBillingPalette(palette)) await expect(save(db,ids.a,doc)).resolves.toBeTruthy()
    else await expect(save(db,ids.a,doc)).rejects.toThrow('contrast')
  }
})
it('rejects malformed or low-contrast palettes and image content spoofing on writes',async()=>{
  await login(db)
  for(const palette of [null,[],{}, {...billingPalettes[0],accent:'#ffffff'}, {...billingPalettes[0],ink:'#ffffff'}, {...billingPalettes[0],paper:'red'}, {...billingPalettes[0],extra:'value'}]) {
    const doc=document();doc.issuer.palette=palette
    await expect(save(db,ids.a,doc)).rejects.toThrow()
    await expect(saveProfile(ids.a,{...profile,palette},2)).rejects.toThrow()
  }
  for(const logo of ['data:image/png;base64,PHN2Zy8+', 'data:image/jpeg;base64,PHNjcmlwdD4=','https://example.com/logo.png']) {
    const doc=document();doc.issuer.logo=logo
    await expect(save(db,ids.a,doc)).rejects.toThrow()
  }
})
it('does not broaden profile access or allow cross-company document writes',async()=>{
  for(const user of ['viewer','outsider','editorB']) {
    await login(db,user)
    await expect(saveProfile(ids.a,{...profile,palette:billingPalettes[1]},2)).rejects.toThrow('Forbidden')
    await expect(save(db,ids.a,{...document(),issuer:{...profile,palette:billingPalettes[1]}})).rejects.toThrow('Forbidden')
  }
  await login(db,'editorB')
  expect((await db.query('select * from public.invoice_settings where company_id=$1',[ids.a])).rows).toEqual([])
  await expect(db.query('select public.validate_billing_palette($1::jsonb)',[JSON.stringify(billingPalettes[0])])).rejects.toThrow('permission denied')
})
it('accepts a decoded PNG signature and keeps the inline logo in the document snapshot',async()=>{
  await login(db)
  const logo='data:image/png;base64,'+(await readFile(new URL('../fixtures/billing-logo.png',import.meta.url))).toString('base64')
  const doc=document();doc.issuer={...doc.issuer,logo,palette:billingPalettes[0]}
  const row=await save(db,ids.a,doc,'draft','quote')
  expect(row.document.issuer.logo).toBe(logo)
})
it('revokes profile access and writes for an inactive membership',async()=>{
  await db.exec('reset role')
  await db.query('update public.company_members set is_active=false where company_id=$1 and user_id=$2',[ids.a,ids.editor])
  await login(db)
  await expect(saveProfile(ids.a,{...profile,palette:billingPalettes[0]},2)).rejects.toThrow('Forbidden')
  expect((await db.query('select * from public.invoice_settings')).rows).toEqual([])
})
