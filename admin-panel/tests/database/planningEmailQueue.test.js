import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'

let db
beforeAll(async()=>{
  db=await database()
  await db.exec('create role service_role bypassrls')
  await db.exec(await sqlFile('migrations/PLANNING_TENANT_HARDENING.sql'))
  await db.exec(`alter table public.planning_task add column title text default 'Meeting',add column created_by uuid,add column reminders integer[] default '{}',add column recurrence_type text default 'none',add column recurrence_value integer;
    create table public.planning_reminder_sent(task_id uuid,minutes_before integer,occurrence_at timestamptz,primary key(task_id,minutes_before,occurrence_at));`)
  await db.exec(await sqlFile('migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql'))
  await db.exec(await sqlFile('migrations/PLANNING_EMAIL_QUEUE.sql'))
  await login(db)
},30000)
afterAll(async()=>db?.close())

beforeEach(async()=>{
  await db.exec('reset role')
  await db.exec('delete from public.planning_email_queue; delete from public.planning_reminder_sent;')
  await login(db)
})

async function enqueueTask(company=ids.a,creator=ids.editor){
  await login(db,creator==='editor'? 'editor':'dual')
  return (await db.query("insert into public.planning_task(company_id,created_by,start_datetime,title,reminders) values($1,$2,now()-interval '2 minutes','Planning meeting',array[0]) returning *",[company,creator])).rows[0]
}
async function asService(){await db.exec('reset role;set role service_role')}

it('enqueues once, claims atomically and writes the sent marker after completion',async()=>{
  const task=await enqueueTask()
  await asService()
  expect((await db.query('select public.enqueue_due_planning_emails(10) n')).rows[0].n).toBe(1)
  expect((await db.query('select public.enqueue_due_planning_emails(10) n')).rows[0].n).toBe(0)
  const job=(await db.query('select * from public.claim_planning_email_batch(10)')).rows[0]
  expect(job).toMatchObject({task_id:task.id,company_id:ids.a,recipient_id:ids.editor,attempt_count:1})
  expect(job.queue_id).toBeTruthy()
  expect((await db.query("select public.complete_planning_email($1,'provider-id') ok",[job.queue_id])).rows[0].ok).toBe(true)
  expect((await db.query('select status,provider_message_id from public.planning_email_queue where id=$1',[job.queue_id])).rows[0]).toMatchObject({status:'sent',provider_message_id:'provider-id'})
  expect((await db.query('select * from public.planning_reminder_sent where task_id=$1',[task.id])).rows).toHaveLength(1)
  await db.query("update public.planning_email_queue set sent_at=now()-interval '91 days' where id=$1",[job.queue_id])
  expect((await db.query('select public.purge_planning_email_queue() removed')).rows[0].removed).toBe(1)
})

it('backs off retryable failures and lets only a company editor retry a dead letter',async()=>{
  await enqueueTask()
  await asService();await db.query('select public.enqueue_due_planning_emails(10)')
  const job=(await db.query('select * from public.claim_planning_email_batch(10)')).rows[0]
  expect((await db.query("select public.fail_planning_email($1,'provider_unavailable',true) status",[job.queue_id])).rows[0].status).toBe('queued')
  const delay=(await db.query('select extract(epoch from (available_at-now())) seconds from public.planning_email_queue where id=$1',[job.queue_id])).rows[0].seconds
  expect(Number(delay)).toBeGreaterThan(20)
  await db.query('update public.planning_email_queue set available_at=now() where id=$1',[job.queue_id])
  let next=(await db.query('select * from public.claim_planning_email_batch(10)')).rows[0]
  for(let i=0;i<6;i++){
    await db.query("select public.fail_planning_email($1,'provider_rejected',true)",[next.queue_id])
    await db.query('update public.planning_email_queue set available_at=now() where id=$1',[job.queue_id])
    next=(await db.query('select * from public.claim_planning_email_batch(10)')).rows[0]
  }
  await db.query("select public.fail_planning_email($1,'provider_rejected',true)",[next.queue_id])
  await login(db,'viewer')
  expect((await db.query('select * from public.list_planning_email_failures($1)',[ids.a])).rows).toHaveLength(1)
  await expect(db.query('select public.retry_planning_email($1,$2)',[ids.a,job.queue_id])).rejects.toThrow('Forbidden')
  await login(db)
  expect((await db.query('select public.retry_planning_email($1,$2) ok',[ids.a,job.queue_id])).rows[0].ok).toBe(true)
  await asService()
  expect((await db.query('select status,attempt_count,delivery_generation from public.planning_email_queue where id=$1',[job.queue_id])).rows[0]).toMatchObject({status:'queued',attempt_count:0,delivery_generation:1})
})

it('keeps an accepted-but-unconfirmed send dead and prevents a duplicate manual retry',async()=>{
  await enqueueTask()
  await asService();await db.query('select public.enqueue_due_planning_emails(10)')
  const job=(await db.query('select * from public.claim_planning_email_batch(10)')).rows[0]
  await db.query("select public.fail_planning_email($1,'sent_marker_failed',false,'provider-message-1')",[job.queue_id])
  await login(db)
  expect((await db.query('select public.retry_planning_email($1,$2) ok',[ids.a,job.queue_id])).rows[0].ok).toBe(false)
  await asService()
  expect((await db.query('select status,last_error_code,provider_message_id,delivery_generation from public.planning_email_queue where id=$1',[job.queue_id])).rows[0]).toMatchObject({status:'dead',last_error_code:'sent_marker_failed',provider_message_id:'provider-message-1',delivery_generation:0})
})

it('does not retry a stale claimed job after the provider idempotency window',async()=>{
  await enqueueTask()
  await asService();await db.query('select public.enqueue_due_planning_emails(10)')
  const job=(await db.query('select * from public.claim_planning_email_batch(10)')).rows[0]
  await db.query("update public.planning_email_queue set locked_at=now()-interval '21 hours' where id=$1",[job.queue_id])
  expect((await db.query('select * from public.claim_planning_email_batch(10)')).rows).toHaveLength(0)
  await login(db)
  expect((await db.query('select public.retry_planning_email($1,$2) ok',[ids.a,job.queue_id])).rows[0].ok).toBe(false)
  await asService()
  expect((await db.query('select status,last_error_code from public.planning_email_queue where id=$1',[job.queue_id])).rows[0]).toMatchObject({status:'dead',last_error_code:'sent_marker_failed'})
})

it('keeps queue rows private from direct client access and blocks cross-company retry',async()=>{
  const task=await enqueueTask()
  await asService();await db.query('select public.enqueue_due_planning_emails(10)')
  const job=(await db.query('select * from public.claim_planning_email_batch(10)')).rows[0]
  await db.query("select public.fail_planning_email($1,'provider_rejected',false)",[job.queue_id])
  await login(db,'dual')
  await expect(db.query('select * from public.planning_email_queue')).rejects.toThrow('permission denied')
  expect((await db.query('select public.retry_planning_email($1,$2) ok',[ids.b,job.queue_id])).rows[0].ok).toBe(false)
  expect(task.company_id).toBe(ids.a)
})
