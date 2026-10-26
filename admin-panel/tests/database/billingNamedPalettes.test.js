import {beforeAll,afterAll,it,expect} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'
import {billingPalettes} from '../../src/lib/billingAppearance'
let db
const palette={...billingPalettes[0],id:'custom'}
const create=async(company=ids.a,name='Arena y mar',colors=palette)=>(await db.query('select public.save_billing_color_palette($1,$2,$3::jsonb) as entry',[company,name,JSON.stringify(colors)])).rows[0].entry
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_NAMED_PALETTES.sql'])await db.exec(await sqlFile('migrations/'+file))
  await login(db)
},30000)
afterAll(async()=>{await db?.close()})

it('saves a named palette, trims its name and makes retries idempotent without overwriting other colors',async()=>{
  const first=await create(ids.a,' Arena y mar ')
  expect(first).toMatchObject({company_id:ids.a,name:'Arena y mar',palette,created_by:ids.editor})
  expect((await create(ids.a,'arena Y mar')).id).toBe(first.id)
  await expect(create(ids.a,'Arena y mar',{...billingPalettes[1],id:'custom'})).rejects.toThrow('already exists')
  expect((await db.query('select palette from public.billing_color_palettes where id=$1',[first.id])).rows[0].palette).toEqual(palette)
})
it('rejects invalid names and palettes at the server boundary',async()=>{
  for(const name of [null,'','   ','x'.repeat(61),'Invalid\nname'])await expect(create(ids.a,name)).rejects.toThrow('name')
  for(const colors of [null,{}, {...palette,ink:'#ffffff'}, {...palette,extra:'unsafe'},billingPalettes[0]])await expect(create(ids.a,'Bad colors',colors)).rejects.toThrow()
})
it('shares palettes with company readers while denying unauthorized writes and cross-company access',async()=>{
  for(const user of ['viewer','outsider','editorB']) {
    await login(db,user)
    await expect(create()).rejects.toThrow('Forbidden')
    const rows=(await db.query('select * from public.billing_color_palettes where company_id=$1',[ids.a])).rows
    expect(rows.length).toBe(user==='viewer' ? 1 : 0)
  }
  await login(db,'editorB')
  expect((await create(ids.b)).company_id).toBe(ids.b)
  expect((await db.query('select * from public.billing_color_palettes')).rows.every(row=>row.company_id===ids.b)).toBe(true)
})
it('denies direct mutations and anonymous access',async()=>{
  await login(db)
  for(const sql of ["insert into public.billing_color_palettes(company_id,name,palette,created_by) values ($1,'Bypass',$2::jsonb,$3)","update public.billing_color_palettes set company_id=$1 where palette=$2::jsonb and created_by=$3","delete from public.billing_color_palettes where company_id=$1 and palette=$2::jsonb and created_by=$3"]) {
    await expect(db.query(sql,[ids.a,JSON.stringify(palette),ids.editor])).rejects.toThrow('permission denied')
  }
  await login(db,null,'anon')
  await expect(create()).rejects.toThrow('permission denied')
  await expect(db.query('select * from public.billing_color_palettes')).rejects.toThrow('permission denied')
})
it('keeps invoice and quote color snapshots independent from the saved palette library',async()=>{
  await login(db)
  const doc=document();doc.issuer.palette=(await create()).palette
  const invoice=await save(db,ids.a,doc),quote=await save(db,ids.a,doc,'draft','quote')
  await create(ids.a,'Bosque',{...billingPalettes[2],id:'custom'})
  for(const [table,row] of [['invoices',invoice],['quotes',quote]]) {
    expect((await db.query(`select document from public.${table} where id=$1`,[row.id])).rows[0].document.issuer.palette).toEqual(palette)
  }
})
it('revokes reads and writes when the company membership becomes inactive',async()=>{
  await db.exec('reset role')
  await db.query('update public.company_members set is_active=false where company_id=$1 and user_id=$2',[ids.a,ids.editor])
  await login(db)
  expect((await db.query('select * from public.billing_color_palettes')).rows).toEqual([])
  await expect(create()).rejects.toThrow('Forbidden')
})
