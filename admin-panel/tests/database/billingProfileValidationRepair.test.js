import {readFile} from 'node:fs/promises'
import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,document,ids,login,profile,save,sqlFile} from './helpers'
import {billingPalettes} from '../../src/lib/billingAppearance'
let db,legacy,png
const saveProfile=async value=>{
  const version=(await db.query('select version from public.invoice_settings where company_id=$1',[ids.a])).rows[0]?.version||0
  return db.query('select public.save_invoice_profile($1,$2,$3)',[ids.a,value,version])
}
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING','BILLING_DOCUMENT_PRESENTATION','BILLING_APPEARANCE','BILLING_DRAFTS','BILLING_NAMED_PALETTES','BILLING_DIRECTORY_CATALOG','BILLING_CHAPTER_TEMPLATES','BILLING_PAYMENTS_HISTORY','BILLING_ISSUED_INVOICE_LOCK','BILLING_RECTIFYING_INVOICES'])await db.exec(await sqlFile('migrations/'+file+'.sql'))
  png='data:image/png;base64,'+(await readFile(new URL('../fixtures/billing-logo.png',import.meta.url))).toString('base64')
  await login(db)
  const bad=document();bad.issuer={...bad.issuer,palette:{id:'custom',accent:'invalid'},logo:'data:image/png;base64,AAAA'}
  legacy=await save(db,ids.a,bad,'issued')
  await saveProfile(bad.issuer)
  await db.exec('reset role');await db.exec(await sqlFile('migrations/BILLING_PROFILE_VALIDATION_REPAIR.sql'));await login(db)
},30000)
afterAll(async()=>{await db?.close()})
it('closes the reproduced regression without rewriting a previously issued document',async()=>{
  expect((await db.query('select document from public.invoices where id=$1',[legacy.id])).rows[0].document).toEqual(legacy.document)
  expect((await db.query('select profile from public.invoice_settings where company_id=$1',[ids.a])).rows[0].profile).toEqual(legacy.document.issuer)
  await expect(save(db,ids.a,legacy.document)).rejects.toThrow()
})
it('rejects invalid palettes on both profile and document writes',async()=>{
  for(const palette of [null,[],{}, {...billingPalettes[0],accent:'invalid'}, {...billingPalettes[0],ink:'#ffffff'}, {...billingPalettes[0],extra:'x'}]){
    await expect(saveProfile({...profile,palette})).rejects.toThrow()
    const d=document();d.issuer.palette=palette
    await expect(save(db,ids.a,d)).rejects.toThrow()
    await expect(save(db,ids.a,d,'draft','quote')).rejects.toThrow()
  }
})
it('checks logo encoding, size, declared format and signatures on both entry points',async()=>{
  for(const logo of ['data:image/png;base64,AAAA','data:image/png;base64,A','data:image/jpeg;base64,PHNjcmlwdD4=',png.replace('image/png','image/jpeg'),'https://example.test/logo.png','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,'+'A'.repeat(1400001)]){
    await expect(saveProfile({...profile,logo})).rejects.toThrow()
    const d=document();d.issuer.logo=logo
    await expect(save(db,ids.a,d)).rejects.toThrow()
  }
})
it('accepts presets, custom palette, PNG and legacy profiles without a palette',async()=>{
  for(const palette of [...billingPalettes,{...billingPalettes[0],id:'custom'}]){
    const d=document();d.issuer={...d.issuer,palette,logo:png,rectificationPrefix:'RECT_2026'}
    expect((await save(db,ids.a,d)).document.issuer).toMatchObject({palette,logo:png,rectificationPrefix:'RECT_2026'})
    await expect(saveProfile(d.issuer)).resolves.toBeTruthy()
  }
  expect((await save(db)).document.issuer).not.toHaveProperty('palette')
})
it('validates issuer appearance when issuing a rectifying invoice',async()=>{
  const d=document();d.issuer.palette={...billingPalettes[0],muted:'#ffffff'}
  await expect(db.query("select public.rectify_invoice($1,$2,$3,'substitution','other','Correction',$4)",[ids.a,legacy.id,d,crypto.randomUUID()])).rejects.toThrow('contrast')
})
it('preserves rectification series validation added by the later migration',async()=>{
  for(const rectificationPrefix of ['',null,123,'spaces here','x'.repeat(21)]){
    const d=document();d.issuer.rectificationPrefix=rectificationPrefix
    await expect(save(db,ids.a,d)).rejects.toThrow()
    await expect(saveProfile({...profile,rectificationPrefix})).rejects.toThrow()
  }
})
it('does not broaden validation execution or tenant write permissions',async()=>{
  for(const user of ['viewer','outsider','editorB']){
    await login(db,user)
    await expect(saveProfile({...profile,palette:billingPalettes[0]})).rejects.toThrow('Forbidden')
    await expect(save(db)).rejects.toThrow('Forbidden')
  }
  await login(db);await expect(db.query('select public.validate_billing_profile($1)',[profile])).rejects.toThrow('permission denied')
})
