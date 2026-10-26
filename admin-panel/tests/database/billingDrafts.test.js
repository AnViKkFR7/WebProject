import {beforeAll,afterAll,it,expect} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'
let db
const request='30000000-0000-4000-8000-000000000001'
const write='30000000-0000-4000-8000-000000000002'
const incomplete=()=>({...document(),customer:{name:'',taxId:'',address:'',email:''},lines:[{description:'',quantity:'',price:'12.',discount:0,tax:21}]})
const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value
const draft=(company=ids.a,kind='invoice',key='new',doc=incomplete(),version=0,token=write,base=null)=>rpc('save_billing_draft',[company,kind,key,JSON.stringify(doc),base,version,token])
const get=(company=ids.a,kind='invoice',key='new')=>rpc('get_billing_draft',[company,kind,key])
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DRAFTS.sql'])await db.exec(await sqlFile('migrations/'+file))
  await login(db)
},30000)
afterAll(async()=>{await db?.close()})
it('stores incomplete work without numbers and retries one write without duplicating the audit event',async()=>{
  const row=await draft()
  expect(row.document.customer.name).toBe('')
  expect(row.owner_id).toBe(ids.editor)
  expect((await draft()).id).toBe(row.id)
  expect((await db.query('select count(*)::int as count from public.invoices')).rows[0].count).toBe(0)
  await db.exec('reset role')
  expect((await db.query('select count(*)::int as count from public.billing_draft_events')).rows[0].count).toBe(1)
  await login(db)
  expect((await get()).version).toBe(1)
})
it('uses compare-and-swap and rejects stale or malformed writes',async()=>{
  const original=await get()
  const changed=incomplete();changed.customer.name='Latest'
  const row=await draft(ids.a,'invoice','new',changed,original.version,request)
  expect(row.version).toBe(2)
  await expect(draft(ids.a,'invoice','new',incomplete(),1)).rejects.toMatchObject({code:'40001'})
  for(const doc of [{}, {...incomplete(),customer:{name:{hostile:true}}}, {...incomplete(),issuer:{name:'X',logo:'https://example.com/logo.svg'}}, {...incomplete(),lines:[{description:{bad:true}}]}])await expect(draft(ids.a,'quote','new',doc)).rejects.toThrow()
})
it('never exposes another author’s work even inside the same company; denies readers, outsiders and anonymous users',async()=>{
  await login(db,'dual')
  expect(await get()).toBeNull()
  const row=await draft()
  expect(row.owner_id).toBe(ids.dual)
  expect((await db.query('select * from public.billing_drafts')).rows.every(item=>item.owner_id===ids.dual)).toBe(true)
  for(const user of ['viewer','outsider','editorB']) {
    await login(db,user)
    expect((await db.query('select * from public.billing_drafts where company_id=$1',[ids.a])).rows).toEqual([])
    await expect(draft()).rejects.toThrow('Forbidden')
    await expect(get()).rejects.toThrow('Forbidden')
  }
  await login(db,null,'anon')
  await expect(get()).rejects.toThrow('permission denied')
})
it('requires an explicit valid commit, consumes the recovery copy atomically and makes final retries idempotent',async()=>{
  await login(db)
  const row=await get()
  await expect(rpc('commit_billing_draft',[ids.a,'invoice','new',row.id,row.version,JSON.stringify(incomplete()),'issued',null])).rejects.toThrow()
  expect((await get()).id).toBe(row.id)
  const args=[ids.a,'invoice','new',row.id,row.version,JSON.stringify(document()),'issued',null]
  const final=await rpc('commit_billing_draft',args)
  expect(final.status).toBe('issued')
  expect(await get()).toBeNull()
  expect((await rpc('commit_billing_draft',args)).id).toBe(final.id)
  expect((await rpc('get_billing_draft',[ids.a,'invoice','new',row.id])).completed_record.id).toBe(final.id)
  await expect(rpc('commit_billing_draft',[...args.slice(0,5),JSON.stringify({...document(),notes:'different'}),'issued',null])).rejects.toMatchObject({code:'40001'})
  expect((await db.query('select * from public.invoices')).rows).toHaveLength(1)
  await expect(draft(ids.a,'invoice',final.id,document(),0,write,final.version)).rejects.toMatchObject({code:'40001'})
})
it('keeps existing draft versions scoped to their document and detects an external edit before commit',async()=>{
  const source=await save(db,ids.a,document(),'draft','quote')
  const row=await draft(ids.a,'quote',source.id,incomplete(),0,write,source.version)
  await save(db,ids.a,{...document(),notes:'other edit'},'draft','quote',source)
  await expect(rpc('commit_billing_draft',[ids.a,'quote',source.id,row.id,row.version,JSON.stringify(document()),'sent',source.version])).rejects.toMatchObject({code:'40001'})
  await expect(draft(ids.b,'quote',source.id,incomplete(),0,write,source.version)).rejects.toThrow('Forbidden')
})
it('expires recovery copies, denies direct mutations/audit access, and cuts access after membership revocation',async()=>{
  await expect(db.query('delete from public.billing_drafts')).rejects.toThrow('permission denied')
  await expect(db.query('select * from public.billing_draft_events')).rejects.toThrow('permission denied')
  await expect(db.query('select public.purge_billing_recovery()')).rejects.toThrow('permission denied')
  await db.exec('reset role')
  await db.exec("update public.billing_drafts set expires_at=now()-interval '1 day'")
  await login(db)
  expect((await db.query('select * from public.billing_drafts')).rows).toEqual([])
  expect(await get()).toBeNull()
  await db.exec('reset role')
  await db.query('update public.company_members set is_active=false where company_id=$1 and user_id=$2',[ids.a,ids.editor])
  await login(db)
  await expect(get()).rejects.toThrow('Forbidden')
  await expect(draft()).rejects.toThrow('Forbidden')
})
