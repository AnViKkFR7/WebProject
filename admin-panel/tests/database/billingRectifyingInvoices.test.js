import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'

let db
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DIRECTORY_CATALOG.sql','BILLING_CHAPTER_TEMPLATES.sql','BILLING_PAYMENTS_HISTORY.sql','BILLING_ISSUED_INVOICE_LOCK.sql','BILLING_RECTIFYING_INVOICES.sql'])
    await db.exec(await sqlFile(`migrations/${file}`))
  await login(db)
},30000)
afterAll(async()=>db?.close())

const issueRectification=(company,original,doc,method,request='40000000-0000-4000-8000-000000000021')=>db.query(
  'select to_jsonb(public.rectify_invoice($1,$2,$3,$4,$5,$6,$7)) result',
  [company,original.id,doc,method,'other','Corrección revisada con el cliente',request],
)

it('issues immutable corrective invoices from issued originals with an independent company series and an idempotent request',async()=>{
  const original=await save(db,ids.a,document(),'issued')
  const correction=document();correction.lines[0].sign=-1
  const first=(await issueRectification(ids.a,original,correction,'difference')).rows[0].result
  expect(first).toMatchObject({status:'issued',number:'FR-000001',rectifies_invoice_id:original.id,rectification_method:'difference',rectification_cause:'other'})
  expect(first.document.rectification).toMatchObject({originalId:original.id,originalNumber:original.number,method:'difference',note:'Corrección revisada con el cliente',originalTotal:121})
  expect((await db.query('select public.billing_document_total($1) total',[first.document])).rows[0].total).toBe('-121.00')
  expect((await db.query('select payment_state,balance from public.get_invoice_financials($1) where invoice_id=$2',[ids.a,first.id])).rows[0]).toMatchObject({payment_state:'credit',balance:'0'})
  expect((await issueRectification(ids.a,original,correction,'difference')).rows[0].result.id).toBe(first.id)
  const next=(await issueRectification(ids.a,original,document(),'substitution','40000000-0000-4000-8000-000000000022')).rows[0].result
  expect(next.number).toBe('FR-000002')
  await login(db,'dual')
  const other=await save(db,ids.b,document(),'issued')
  const b=(await issueRectification(ids.b,other,document(),'substitution','40000000-0000-4000-8000-000000000023')).rows[0].result
  expect(b.number).toBe('FR-000001')
})

it('rejects drafts, foreign-company originals, invalid methods and negative line signs for substitution',async()=>{
  await login(db,'dual')
  const draft=await save(db)
  await expect(issueRectification(ids.a,draft,document(),'difference','40000000-0000-4000-8000-000000000031')).rejects.toThrow('not eligible')
  await expect(issueRectification(ids.b,draft,document(),'difference','40000000-0000-4000-8000-000000000032')).rejects.toThrow('not eligible')
  const issued=await save(db,ids.a,document(),'issued')
  await expect(issueRectification(ids.a,issued,document(),'unknown','40000000-0000-4000-8000-000000000033')).rejects.toThrow('Invalid rectification')
  const signed=document();signed.lines[0].sign=-1
  await expect(issueRectification(ids.a,issued,signed,'substitution','40000000-0000-4000-8000-000000000034')).rejects.toThrow('cannot carry a sign')
  await expect(db.query('select public.save_invoice($1,$2,$3,null,null)',[ids.a,{...document(),rectification:{}},'issued'])).rejects.toThrow('Use rectify_invoice')
})

