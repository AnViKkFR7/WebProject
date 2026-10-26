import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'
let db
beforeAll(async()=>{db=await database();for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DIRECTORY_CATALOG.sql','BILLING_CHAPTER_TEMPLATES.sql','BILLING_PAYMENTS_HISTORY.sql'])await db.exec(await sqlFile('migrations/'+file));await login(db)},30000)
afterAll(async()=>db?.close())
it('registers partial payments, prevents overpayment and makes retries idempotent',async()=>{
  const invoice=await save(db,ids.a,document(),'issued');const request='40000000-0000-4000-8000-000000000001'
  const first=(await db.query('select public.register_invoice_payment($1,$2,$3,$4,$5,$6,$7,$8) result',[ids.a,invoice.id,invoice.version,request,50,'2026-10-24','Transferencia','REF-1'])).rows[0].result
  expect(first.balance).toBe(71);expect(first.invoice_status).toBe('issued')
  const retry=(await db.query('select public.register_invoice_payment($1,$2,$3,$4,$5,$6,$7,$8) result',[ids.a,invoice.id,invoice.version,request,50,'2026-10-24','Transferencia','REF-1'])).rows[0].result
  expect(retry).toMatchObject({id:first.id,balance:71,invoice_status:'issued',invoice_version:first.invoice_version});expect((await db.query('select count(*) count from public.billing_payment_entries where invoice_id=$1',[invoice.id])).rows[0].count).toBe(1)
  await expect(db.query('select public.register_invoice_payment($1,$2,$3,$4,$5,current_date,$6,$7)',[ids.a,invoice.id,first.invoice_version,'40000000-0000-4000-8000-000000000002',100,'Tarjeta','REF-2'])).rejects.toThrow('exceeds')
})
it('settles an invoice, reverses without deleting and records append-only history',async()=>{
  const invoice=await save(db,ids.a,document(),'issued');const payment=(await db.query('select public.register_invoice_payment($1,$2,$3,$4,$5,current_date,$6,$7) result',[ids.a,invoice.id,invoice.version,'40000000-0000-4000-8000-000000000003',121,'Transferencia','TOTAL'])).rows[0].result
  expect(payment.invoice_status).toBe('paid')
  const reversed=(await db.query('select public.reverse_invoice_payment($1,$2,$3,$4) result',[ids.a,payment.id,'40000000-0000-4000-8000-000000000004','Transferencia devuelta'])).rows[0].result
  expect(reversed.invoice_status).toBe('issued');expect((await db.query('select count(*) count from public.billing_payment_entries where invoice_id=$1',[invoice.id])).rows[0].count).toBe(2)
  const retry=(await db.query('select public.reverse_invoice_payment($1,$2,$3,$4) result',[ids.a,payment.id,'40000000-0000-4000-8000-000000000004','Transferencia devuelta'])).rows[0].result
  expect(retry).toMatchObject({id:reversed.id,invoice_status:'issued',invoice_version:reversed.invoice_version})
  expect((await db.query("select action from public.billing_document_events where record_id=$1",[invoice.id])).rows.map(row=>row.action)).toEqual(expect.arrayContaining(['created','payment_registered','payment_reversed']))
})
it('restores only draft history as a new revision and isolates roles and companies',async()=>{
  const invoice=await save(db);const changedDoc=document();changedDoc.notes='Nueva';const changed=await save(db,ids.a,changedDoc,'draft','invoice',invoice)
  const originalEvent=(await db.query("select id from public.billing_document_events where record_id=$1 and action='created'",[invoice.id])).rows[0]
  const restored=(await db.query('select public.restore_billing_draft_version($1,$2,$3,$4,$5) result',[ids.a,'invoice',invoice.id,originalEvent.id,changed.version])).rows[0].result
  expect(restored.document.notes).toBe('');expect(restored.version).toBe(changed.version+1)
  await login(db,'viewer');await expect(db.query('select public.register_invoice_payment($1,$2,1,$3,1,current_date,$4,$5)',[ids.a,invoice.id,'40000000-0000-4000-8000-000000000005','x','x'])).rejects.toThrow('Forbidden')
  expect((await db.query('select * from public.billing_document_events')).rows.every(row=>row.company_id===ids.a)).toBe(true)
  await login(db,'editorB');await expect(db.query('select public.restore_billing_draft_version($1,$2,$3,$4,1)',[ids.b,'invoice',invoice.id,originalEvent.id])).rejects.toThrow('Draft version unavailable')
})
it('does not restore an issued snapshot through the draft recovery contract',async()=>{
  await login(db);const invoice=await save(db,ids.a,document(),'issued');const event=(await db.query("select id from public.billing_document_events where record_id=$1 and snapshot->>'status'='issued' order by id limit 1",[invoice.id])).rows[0]
  await expect(db.query('select public.restore_billing_draft_version($1,$2,$3,$4,$5)',[ids.a,'invoice',invoice.id,event.id,invoice.version])).rejects.toThrow('Draft version unavailable')
})
