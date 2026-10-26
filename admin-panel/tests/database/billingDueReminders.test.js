import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'

let db
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DIRECTORY_CATALOG.sql','BILLING_CHAPTER_TEMPLATES.sql','BILLING_PAYMENTS_HISTORY.sql','BILLING_RECTIFYING_INVOICES.sql'])await db.exec(await sqlFile(`migrations/${file}`))
  await db.exec(`create role service_role;create table public.company_modules(company_id uuid,module_key text,is_enabled boolean,primary key(company_id,module_key));insert into public.company_modules values('${ids.a}','billing',true),('${ids.b}','billing',true);create function public.is_company_module_enabled(uuid,text) returns boolean language sql stable as $$ select coalesce((select is_enabled from public.company_modules where company_id=$1 and module_key=$2),true) $$`)
  await db.exec(await sqlFile('migrations/BILLING_DUE_REMINDERS.sql'))
  await login(db)
},30000)
afterAll(async()=>db?.close())

it('stores company schedule without enabling delivery by default and requires an admin to change it',async()=>{
  expect((await db.query('select enabled,offsets_days from public.billing_due_reminder_settings')).rows).toHaveLength(0)
  await expect(db.query("select public.save_billing_due_reminder_settings($1,true,array[7,1,0,-7],time '10:30')",[ids.a])).rejects.toThrow('Forbidden')
  await login(db,'admin')
  const saved=(await db.query("select (public.save_billing_due_reminder_settings($1,true,array[7,1,0,-7],time '10:30')).*",[ids.a])).rows[0]
  expect(saved).toMatchObject({enabled:true,offsets_days:[7,1,0,-7],local_send_time:'10:30:00',timezone:'Europe/Madrid'})
  await login(db)
})

it('enqueues one job per configured offset, excludes suppressed or settled invoices and is idempotent',async()=>{
  const doc=document();doc.dueDate='2026-11-02'
  const invoice=await save(db,ids.a,doc,'issued')
  await login(db,'admin')
  await db.query("select public.save_billing_due_reminder_settings($1,true,array[1,0,-7],time '09:00')",[ids.a])
  await login(db)
  await db.exec('reset role')
  const first=(await db.query("select public.enqueue_billing_due_reminders('2026-11-01') count")).rows[0].count
  const retry=(await db.query("select public.enqueue_billing_due_reminders('2026-11-01') count")).rows[0].count
  expect(first).toBe(1);expect(retry).toBe(0)
  expect((await db.query('select invoice_id,offset_days,status from public.billing_due_reminder_queue')).rows).toEqual([{invoice_id:invoice.id,offset_days:1,status:'queued'}])
  await login(db)
  await db.query('select public.set_invoice_due_reminders($1,$2,true)',[ids.a,invoice.id])
  await db.exec('reset role')
  expect((await db.query('select status,last_error_code from public.billing_due_reminder_queue')).rows[0]).toEqual({status:'skipped',last_error_code:'suppressed'})
})

it('rechecks the billing module and safely ignores malformed due dates',async()=>{
  const doc=document();doc.dueDate='2026-11-02'
  const invoice=await save(db,ids.a,doc,'issued')
  expect((await db.query("select public.billing_safe_document_date('2026-02-31') due_date")).rows[0].due_date).toBeNull()
  await login(db,'admin')
  await db.query("select public.save_billing_due_reminder_settings($1,true,array[0],time '09:00')",[ids.a])
  await db.exec('reset role')
  await db.query("update public.company_modules set is_enabled=false where company_id=$1 and module_key='billing'",[ids.a])
  expect((await db.query("select public.enqueue_billing_due_reminders('2026-11-02') count")).rows[0].count).toBe(0)
  expect((await db.query('select count(*)::int count from public.billing_due_reminder_queue where invoice_id=$1',[invoice.id])).rows[0].count).toBe(0)
})

it('resolves a minimal current payload only for a claimed job and completes it once',async()=>{
  const today=(await db.query("select (now() at time zone 'Europe/Madrid')::date::text date")).rows[0].date
  const dueDate=(await db.query("select (($1::date+1)::text) date",[today])).rows[0].date
  const doc=document();doc.dueDate=dueDate;doc.customer.email='client@example.test'
  const invoice=await save(db,ids.a,doc,'issued')
  await db.exec('reset role')
  await db.query("update public.company_modules set is_enabled=true where company_id=$1 and module_key='billing'",[ids.a])
  await login(db,'admin')
  await db.query("select public.save_billing_due_reminder_settings($1,true,array[1],time '09:00')",[ids.a])
  await db.exec('reset role')
  await db.query('select public.enqueue_billing_due_reminders($1::date)',[today])
  await db.exec('set role service_role')
  const claim=await db.query("select * from public.claim_billing_due_reminder_batch(10)");const job=claim.rows[0]
  expect({...job,job_due_date:job?.job_due_date?.toISOString?.().slice(0,10)}).toMatchObject({job_company_id:ids.a,job_invoice_id:invoice.id,job_due_date:dueDate,job_offset_days:1})
  const payload=(await db.query('select * from public.get_billing_due_reminder_payload($1)',[job.queue_id])).rows[0]
  expect({...payload,due_date:payload.due_date.toISOString().slice(0,10),balance:Number(payload.balance)}).toEqual({company_id:ids.a,invoice_id:invoice.id,recipient_email:'client@example.test',invoice_number:invoice.number,due_date:dueDate,balance:121})
  expect((await db.query("select public.complete_billing_due_reminder($1,'resend-id') completed",[job.queue_id])).rows[0].completed).toBe(true)
  expect((await db.query("select public.complete_billing_due_reminder($1,'resend-id') completed",[job.queue_id])).rows[0].completed).toBe(false)
})

it('pausing and resuming reminders skips queued mail and safely requeues the same unsent occurrence',async()=>{
  const today=(await db.query("select (now() at time zone 'Europe/Madrid')::date::text date")).rows[0].date
  const dueDate=(await db.query("select (($1::date+3)::text) date",[today])).rows[0].date
  const doc=document();doc.dueDate=dueDate
  await db.exec('reset role')
  const invoice=await save(db,ids.a,doc,'issued')
  await db.exec('reset role');await db.query("update public.company_modules set is_enabled=true where company_id=$1 and module_key='billing'",[ids.a])
  await login(db,'admin')
  await db.query("select public.save_billing_due_reminder_settings($1,true,array[3],time '09:00')",[ids.a])
  await db.exec('reset role');await db.query('select public.enqueue_billing_due_reminders($1::date)',[today])
  await login(db,'admin')
  await db.query("select public.save_billing_due_reminder_settings($1,false,array[3],time '09:00')",[ids.a])
  expect((await db.query('select status,last_error_code from public.billing_due_reminder_queue where invoice_id=$1',[invoice.id])).rows[0]).toEqual({status:'skipped',last_error_code:'reminders_disabled'})
  await db.query("select public.save_billing_due_reminder_settings($1,true,array[3],time '10:00')",[ids.a])
  await db.exec('reset role');await db.query('select public.enqueue_billing_due_reminders($1::date)',[today])
  expect((await db.query('select count(*)::int count,status from public.billing_due_reminder_queue where invoice_id=$1 group by status',[invoice.id])).rows[0]).toEqual({count:1,status:'queued'})
})
