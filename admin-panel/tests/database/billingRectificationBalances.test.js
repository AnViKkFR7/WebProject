import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'
let db
const doc=(amount)=>{const d=document();d.lines[0].price=amount;d.lines[0].tax=0;d.customer.email='client@example.test';return d}
const uuid=()=>crypto.randomUUID()
const financial=async(id)=>(await db.query('select * from public.get_invoice_financials($1) where invoice_id=$2',[ids.a,id])).rows[0]
const rect=async(original,amount,method='substitution')=>{
  const d=doc(Math.abs(amount));if(amount<0)d.lines[0].sign=-1
  return (await db.query("select to_jsonb(public.rectify_invoice($1,$2,$3,$4,'other','Correction',$5)) row",[ids.a,original.id,d,method,uuid()])).rows[0].row
}
const payment=async(invoice,amount)=>{
  const current=(await db.query('select * from public.invoices where id=$1',[invoice.id])).rows[0]
  return (await db.query("select public.register_invoice_payment($1,$2,$3,$4,$5,current_date,'bank','') row",[ids.a,invoice.id,current.version,uuid(),amount])).rows[0].row
}
beforeAll(async()=>{
  db=await database()
  for(const name of ['BILLING_SECURITY_HARDENING','BILLING_DOCUMENT_PRESENTATION','BILLING_APPEARANCE','BILLING_DIRECTORY_CATALOG','BILLING_CHAPTER_TEMPLATES','BILLING_PAYMENTS_HISTORY','BILLING_ISSUED_INVOICE_LOCK','BILLING_RECTIFYING_INVOICES'])await db.exec(await sqlFile('migrations/'+name+'.sql'))
  await db.exec(`create role service_role;create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);insert into public.company_modules values('${ids.a}','billing',true),('${ids.b}','billing',true);`)
  const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
  const scope=await sqlFile('migrations/COMPANY_MODULES_SCOPE_FIX.sql')
  await db.exec(scope.slice(scope.indexOf('create or replace function public.assert_company_module_enabled'),scope.indexOf('create or replace function public.get_company_customer_email_settings')))
  await db.exec(await sqlFile('migrations/BILLING_DUE_REMINDERS.sql'))
  await db.exec(await sqlFile('migrations/BILLING_RECTIFICATION_BALANCES.sql'))
  await login(db)
},30000)
afterAll(async()=>{await db?.close()})
it('counts a 121 original replaced by 96.80 only once and preserves immutable documents',async()=>{
  const original=await save(db,ids.a,doc(121),'issued'),replacement=await rect(original,96.8)
  expect(await financial(original.id)).toMatchObject({balance:'0',paid:'0',payment_state:'rectified'})
  expect(await financial(replacement.id)).toMatchObject({total:'96.80',balance:'96.80'})
  expect((await db.query('select document from public.invoices where id=$1',[original.id])).rows[0].document).toEqual(original.document)
})
it('applies positive and negative differences once and resets earlier adjustments at the latest substitution',async()=>{
  const original=await save(db,ids.a,doc(100),'issued')
  await rect(original,-20,'difference');const positive=await rect(original,10,'difference')
  expect(await financial(positive.id)).toMatchObject({total:'90.00',balance:'90.00'})
  await rect(original,80);const last=await rect(original,-5,'difference')
  expect(await financial(last.id)).toMatchObject({total:'75.00',balance:'75.00'})
})
it('carries previous payments, prevents new payments on superseded invoices and preserves reversals',async()=>{
  const original=await save(db,ids.a,doc(121),'issued'),paid=await payment(original,40),replacement=await rect(original,96.8)
  expect(await financial(replacement.id)).toMatchObject({paid:'40.00',balance:'56.80'})
  await expect(payment(original,1)).rejects.toThrow('latest rectifying')
  await payment(replacement,56.8)
  expect(await financial(replacement.id)).toMatchObject({paid:'96.80',balance:'0.00',payment_state:'paid'})
  await db.query("select public.reverse_invoice_payment($1,$2,$3,'Correction')",[ids.a,paid.id,uuid()])
  expect(await financial(replacement.id)).toMatchObject({paid:'56.80',balance:'40.00'})
  await expect(payment(replacement,41)).rejects.toThrow('exceeds balance')
})
it('reports overpayments and net negative families as credit without creating a refund',async()=>{
  const original=await save(db,ids.a,doc(100),'issued');await payment(original,100)
  const replacement=await rect(original,80)
  expect(await financial(replacement.id)).toMatchObject({total:'80.00',paid:'100.00',balance:'0',payment_state:'credit'})
  const other=await save(db,ids.a,doc(20),'issued'),credit=await rect(other,-30,'difference')
  expect(await financial(credit.id)).toMatchObject({total:'-10.00',paid:'0',balance:'0',payment_state:'credit'})
})
it('uses consolidated balances for enqueue, claim and payload, suppressing previously queued originals',async()=>{
  const today=(await db.query("select (now() at time zone 'Europe/Madrid')::date::text as today")).rows[0].today
  const d=doc(121);d.dueDate=today
  const original=await save(db,ids.a,d,'issued');await payment(original,40)
  await login(db,'admin');await db.query("select public.save_billing_due_reminder_settings($1,true,array[0],time '00:00')",[ids.a])
  await db.exec('reset role');await db.query('select public.enqueue_billing_due_reminders($1)',[today])
  await login(db)
  const correction=doc(96.8);correction.dueDate=today
  const replacement=(await db.query("select to_jsonb(public.rectify_invoice($1,$2,$3,'substitution','other','Correction',$4)) row",[ids.a,original.id,correction,uuid()])).rows[0].row
  await db.exec('reset role');await db.query('select public.enqueue_billing_due_reminders($1)',[today])
  const jobs=(await db.query('select * from public.claim_billing_due_reminder_batch(100)')).rows
  expect(jobs.some(j=>j.job_invoice_id===original.id)).toBe(false)
  const job=jobs.find(j=>j.job_invoice_id===replacement.id);expect(job).toBeTruthy()
  const payload=(await db.query('select * from public.get_billing_due_reminder_payload($1)',[job.queue_id])).rows[0]
  expect(payload).toMatchObject({invoice_id:replacement.id,balance:'56.80'})
  await login(db);await payment(replacement,56.8)
  await db.exec('reset role');expect((await db.query('select * from public.get_billing_due_reminder_payload($1)',[job.queue_id])).rows).toEqual([])
})
it('keeps payment retries idempotent after rectification and supports corrections of corrections',async()=>{
  await login(db)
  const original=await save(db,ids.a,doc(100),'issued'),request=uuid()
  const args=[ids.a,original.id,original.version,request,20]
  const run=()=>db.query("select public.register_invoice_payment($1,$2,$3,$4,$5,current_date,'bank','') row",args)
  const first=(await run()).rows[0].row
  const replacement=await rect(original,80),latest=await rect(replacement,-10,'difference')
  const retried=(await run()).rows[0].row
  expect(retried.id).toBe(first.id)
  expect(await financial(latest.id)).toMatchObject({total:'70.00',paid:'20.00',balance:'50.00'})
  await payment(latest,50)
  expect(await financial(latest.id)).toMatchObject({paid:'70.00',balance:'0.00'})
})
it('protects public financials by tenant/module and keeps internal helpers private',async()=>{
  await login(db,'editorB');await expect(db.query('select * from public.get_invoice_financials($1)',[ids.a])).rejects.toThrow('Forbidden')
  await login(db);await expect(db.query('select * from public.invoice_family_financials($1)',[ids.a])).rejects.toThrow('permission denied')
  await db.exec('reset role');await db.query('update public.company_modules set is_enabled=false where company_id=$1',[ids.a])
  await login(db,'admin');await expect(db.query('select * from public.get_invoice_financials($1)',[ids.a])).rejects.toThrow('module is disabled')
})
