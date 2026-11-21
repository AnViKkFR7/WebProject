import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
let db,legacyAttempt
const task=async(type='none')=>(await db.query("insert into public.planning_task(company_id,title,created_by,start_datetime,recurrence_type,recurrence_value,reminders) values($1,'Task',$2,now()-interval '2 minutes',$3,1,array[0]) returning *",[ids.a,ids.editor,type])).rows[0]
const enqueue=()=>db.exec('select public.enqueue_due_planning_emails(10)')
const claim=async()=> (await db.query('select * from public.claim_planning_email_batch(25)')).rows[0]
const valid=async(job,version)=>(await db.query('select public.validate_planning_email_delivery($1,$2,$3,$4) ok',[job.queue_id,job.company_id,job.task_id,version])).rows[0].ok
const queue=async(id)=>(await db.query('select * from public.planning_email_queue where id=$1',[id])).rows[0]
beforeAll(async()=>{
  db=await database()
  await db.exec(`create role service_role;
    alter table public.planning_task add title text,add created_by uuid,add reminders integer[] default '{}',add recurrence_type text default 'none',add recurrence_value int;
    create table public.planning_reminder_sent(task_id uuid,minutes_before int,occurrence_at timestamptz,primary key(task_id,minutes_before,occurrence_at));
    create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);`)
  await db.exec(await sqlFile('migrations/PLANNING_TENANT_HARDENING.sql'))
  await db.exec(await sqlFile('migrations/PLANNING_TASK_MOVE_UNDO.sql'))
  await db.exec(await sqlFile('migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql'))
  await db.exec(await sqlFile('migrations/PLANNING_EMAIL_QUEUE.sql'))
  const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
  const scope=await sqlFile('migrations/COMPANY_MODULES_SCOPE_FIX.sql')
  await db.exec(scope.slice(scope.indexOf('create or replace function public.assert_company_module_enabled'),scope.indexOf('create or replace function public.get_company_customer_email_settings')))
  await db.query("insert into public.company_modules values($1,'planning',true)",[ids.a])
  await db.exec(await sqlFile('migrations/PLANNING_RECURRENCE_WINDOW.sql'))
  await task();await enqueue();legacyAttempt=await claim()
  await db.exec(await sqlFile('migrations/PLANNING_EMAIL_STALE_GUARD.sql'))
},30000)
afterAll(async()=>{await db?.close()})
it('quarantines previously attempted legacy deliveries instead of guessing whether they were sent',async()=>{
  expect(await queue(legacyAttempt.queue_id)).toMatchObject({status:'dead',last_error_code:'sent_marker_failed',task_version:null})
})
beforeEach(async()=>{await db.exec("reset role;delete from public.planning_reminder_sent;delete from public.planning_email_queue where task_version is not null;update public.planning_task set reminders='{}';")})
it('validates an unchanged task and rejects cross-company identifiers',async()=>{
  const t=await task();await enqueue();const job=await claim()
  expect(await valid(job,t.version)).toBe(true)
  expect(await valid({...job,company_id:ids.b},t.version)).toBe(false)
  expect((await queue(job.queue_id)).status).toBe('sending')
})
it('invalidates a claimed job after editing the task without rearming an attempted occurrence',async()=>{
  const t=await task('daily');await enqueue();const job=await claim()
  await db.query("update public.planning_task set title='New content' where id=$1",[t.id])
  expect(await valid(job,t.version)).toBe(false)
  expect((await queue(job.queue_id)).status).toBe('skipped')
  await enqueue();expect((await queue(job.queue_id)).status).toBe('skipped')
})
it('rearms a never-attempted occurrence with the current version and checks enabled reminders',async()=>{
  const t=await task();await enqueue()
  await db.query("update public.planning_task set title='Edited before claim' where id=$1",[t.id])
  await enqueue();const job=await claim()
  expect(await valid(job,t.version+1)).toBe(true)
  await db.query("update public.planning_task set reminders='{}' where id=$1",[t.id])
  expect(await valid(job,t.version+1)).toBe(false)
})
it('checks recurrence and start independently of the trigger and expires invalid queue payloads',async()=>{
  const t=await task('weekly');await enqueue();const job=await claim()
  await db.query("update public.planning_email_queue set occurrence_at=occurrence_at+interval '1 day' where id=$1",[job.queue_id])
  expect(await valid(job,t.version)).toBe(false)
  expect((await queue(job.queue_id)).status).toBe('skipped')
})
it('creates a distinct current occurrence after a move and never reuses the attempted old job',async()=>{
  const t=await task();await enqueue();const old=await claim()
  await db.query("update public.planning_task set start_datetime=start_datetime-interval '1 minute' where id=$1",[t.id])
  await enqueue();const current=await claim()
  expect(current.queue_id).not.toBe(old.queue_id)
  expect(await valid(current,t.version+1)).toBe(true)
  expect((await queue(old.queue_id)).status).toBe('skipped')
})
it('checks the current module and reminder selection immediately before delivery',async()=>{
  const t=await task();await enqueue();const job=await claim()
  await db.query('update public.planning_email_queue set minutes_before=60 where id=$1',[job.queue_id])
  expect(await valid(job,t.version)).toBe(false)
  await db.query("update public.planning_email_queue set status='sending',minutes_before=0 where id=$1",[job.queue_id])
  await db.query('update public.company_modules set is_enabled=false where company_id=$1',[ids.a])
  expect(await valid(job,t.version)).toBe(false)
  await db.query('update public.company_modules set is_enabled=true where company_id=$1',[ids.a])
  await db.query("update public.planning_email_queue set status='sending' where id=$1",[job.queue_id])
  await db.query('update public.company_members set is_active=false where company_id=$1 and user_id=$2',[ids.a,ids.editor])
  expect(await valid(job,t.version)).toBe(false)
  await db.query('update public.company_members set is_active=true where company_id=$1 and user_id=$2',[ids.a,ids.editor])
})
it('preserves provider confirmation if an edit races with an already accepted delivery',async()=>{
  const t=await task();await enqueue();const job=await claim();expect(await valid(job,t.version)).toBe(true)
  await db.query("update public.planning_task set start_datetime=start_datetime+interval '1 day' where id=$1",[t.id])
  expect((await db.query("select public.complete_planning_email($1,'provider-accepted') ok",[job.queue_id])).rows[0].ok).toBe(true)
  expect(await queue(job.queue_id)).toMatchObject({status:'sent',provider_message_id:'provider-accepted'})
  expect((await db.query('select * from public.planning_reminder_sent where task_id=$1',[t.id])).rows).toHaveLength(1)
})
it('restricts final validation to service role and blocks stale manual retries',async()=>{
  const t=await task();await enqueue();const job=await claim()
  await db.exec("update public.planning_task set title='Changed'")
  await db.query("update public.planning_email_queue set status='dead',last_error_code='provider_unavailable' where id=$1",[job.queue_id])
  await login(db);await expect(valid(job,t.version)).rejects.toThrow('permission denied')
  expect((await db.query('select public.retry_planning_email($1,$2) ok',[ids.a,job.queue_id])).rows[0].ok).toBe(false)
})
