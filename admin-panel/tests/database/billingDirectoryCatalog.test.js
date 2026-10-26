import {beforeAll,afterAll,it,expect} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'
let db
const client=async(company=ids.a,name='Cliente fiscal')=>(await db.query("select * from public.save_client_company($1,null,$2,'B123','Calle Mayor','cliente@example.com','600000000','Ana','#1976d2')",[company,name])).rows[0]
const item=async(company=ids.a,name='Consultoría')=>(await db.query("select * from public.save_billing_catalog_item($1,null,$2,'Sesión estratégica','hora',125.50,21)",[company,name])).rows[0]
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DIRECTORY_CATALOG.sql'])await db.exec(await sqlFile('migrations/'+file))
  await login(db)
},30000)
afterAll(async()=>db?.close())

it('extends the existing client directory with fiscal data and archives without breaking documents',async()=>{
  const savedClient=await client()
  expect(savedClient).toMatchObject({company_id:ids.a,name:'Cliente fiscal',tax_id:'B123',billing_address:'Calle Mayor'})
  const doc=document();doc.customer={name:savedClient.name,taxId:savedClient.tax_id,address:savedClient.billing_address,email:savedClient.email}
  const invoice=await save(db,ids.a,doc)
  await db.query('select public.archive_client_company($1,$2)',[ids.a,savedClient.id])
  expect((await db.query('select archived_at is not null as archived from public.client_company where id=$1',[savedClient.id])).rows[0].archived).toBe(true)
  expect((await db.query('select document from public.invoices where id=$1',[invoice.id])).rows[0].document.customer).toEqual(doc.customer)
})
it('saves and archives catalogue entries while documents keep copied values',async()=>{
  const saved=await item()
  expect(saved).toMatchObject({company_id:ids.a,name:'Consultoría',description:'Sesión estratégica',unit:'hora',price:'125.50',tax:'21.00'})
  const doc=document();doc.lines[0]={...doc.lines[0],description:`${saved.name} · ${saved.description} · (${saved.unit})`,price:Number(saved.price),tax:Number(saved.tax)}
  const invoice=await save(db,ids.a,doc)
  await db.query('select public.archive_billing_catalog_item($1,$2)',[ids.a,saved.id])
  expect((await db.query('select archived_at is not null as archived from public.billing_catalog_items where id=$1',[saved.id])).rows[0].archived).toBe(true)
  expect((await db.query('select document from public.invoices where id=$1',[invoice.id])).rows[0].document.lines[0]).toEqual(doc.lines[0])
})
it('isolates directory and catalogue by company and role',async()=>{
  await login(db,'viewer')
  await expect(client()).rejects.toThrow('Forbidden');await expect(item()).rejects.toThrow('Forbidden')
  expect((await db.query('select * from public.billing_catalog_items')).rows.every(row=>row.company_id===ids.a)).toBe(true)
  await login(db,'editorB')
  expect((await client(ids.b,'Cliente B')).company_id).toBe(ids.b)
  expect((await item(ids.b,'Servicio B')).company_id).toBe(ids.b)
  expect((await db.query('select * from public.billing_catalog_items')).rows.every(row=>row.company_id===ids.b)).toBe(true)
})
it('denies anonymous and direct mutations, including cross-company ids',async()=>{
  await login(db)
  await expect(db.query("insert into public.billing_catalog_items(company_id,name,created_by,updated_by) values($1,'Bypass',$2,$2)",[ids.a,ids.editor])).rejects.toThrow('permission denied')
  await expect(db.query("update public.client_company set name='Bypass' where company_id=$1",[ids.a])).rejects.toThrow('permission denied')
  const savedClient=await client()
  await expect(db.query('select public.archive_client_company($1,$2)',[ids.b,savedClient.id])).rejects.toThrow('Forbidden')
  await login(db,null,'anon')
  await expect(item()).rejects.toThrow('permission denied')
  await expect(db.query('select * from public.billing_catalog_items')).rejects.toThrow('permission denied')
})
