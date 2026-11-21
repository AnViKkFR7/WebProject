import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
let db,legacy
const row=async()=> (await db.query('select * from public.company_weekly_summary_queue')).rows[0]
const claim=async()=> (await db.query('select * from public.claim_company_weekly_summary_batch(20)')).rows
const create=async()=> (await db.query("insert into public.company_weekly_summary_queue(company_id,week_start) values($1,'2026-10-19') returning id",[ids.a])).rows[0].id
const allowed=async(id,generation=1)=>(await db.query('select public.validate_company_weekly_summary_delivery($1,$2) ok',[id,generation])).rows[0].ok
beforeAll(async()=>{
  db=await database()
  await db.exec(`create role service_role;alter table auth.users add email text;
    create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);
    create function public.is_company_module_enabled(uuid,text) returns boolean language sql as $$select true$$;
    create table public.lead(company_id uuid,created_at timestamptz);
    create table public.crm_pipeline_stages(id uuid,company_id uuid,is_won boolean,is_lost boolean);
    create table public.crm_contacts(company_id uuid,created_at timestamptz,next_follow_up_at timestamptz,stage_id uuid);
    create table public.analytics_daily(company_id uuid,day date,page_views int);
    create table public.billing_document_events(company_id uuid,kind text,action text,changes jsonb,created_at timestamptz);
    create function public.billing_safe_document_date(text) returns date language sql as $$select null::date$$;`)
  await db.exec(await sqlFile('migrations/WEEKLY_SUMMARY_EMAIL.sql'))
  await db.query('insert into public.company_weekly_summary_settings(company_id,enabled) values($1,true)',[ids.a])
  await db.query("insert into public.company_weekly_summary_queue(company_id,week_start,status,attempt_count,locked_at,created_at) values($1,'2026-10-19','sending',1,now(),now()-interval '30 hours')",[ids.a])
  await db.exec(await sqlFile('migrations/WEEKLY_SUMMARY_RETRY_WINDOW.sql'))
  await claim();legacy=await row()
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{await db.exec('reset role;delete from public.company_weekly_summary_queue;update public.company_weekly_summary_settings set enabled=true')})
it('quarantines legacy attempts beyond the safety window even with a fresh lock',()=>{
  expect(legacy).toMatchObject({status:'dead',last_error_code:'sent_marker_failed'})
  expect(new Date(legacy.first_attempt_at).getTime()).toBe(new Date(legacy.created_at).getTime())
})
it('sets the first-attempt anchor once and preserves it and generation on short recovery',async()=>{
  const id=await create();expect(await claim()).toHaveLength(1)
  const initial=await row();expect(await allowed(id)).toBe(true)
  await db.query("update public.company_weekly_summary_queue set locked_at=now()-interval '11 minutes' where id=$1",[id])
  expect(await allowed(id)).toBe(false)
  const recovered=await claim();expect(recovered[0]).toMatchObject({queue_id:id,delivery_generation:1})
  expect((await row()).first_attempt_at).toEqual(initial.first_attempt_at)
  expect((await row()).attempt_count).toBe(2)
})
it('does not reclaim sending or queued attempts outside the fixed window',async()=>{
  for(const status of ['sending','queued']){
    await db.exec('delete from public.company_weekly_summary_queue');const id=await create();await claim()
    await db.query("update public.company_weekly_summary_queue set status=$1,first_attempt_at=now()-interval '25 hours',locked_at=now() where id=$2",[status,id])
    expect(await claim()).toEqual([]);expect(await row()).toMatchObject({status:'dead',last_error_code:'sent_marker_failed'})
  }
})
it('rechecks the deadline before delivery and never requeues a late provider failure',async()=>{
  const id=await create();await claim()
  await db.query("update public.company_weekly_summary_queue set first_attempt_at=now()-interval '21 hours' where id=$1",[id])
  expect(await allowed(id)).toBe(false)
  await db.query("update public.company_weekly_summary_queue set status='sending' where id=$1",[id])
  await db.query("select public.fail_company_weekly_summary($1,'provider_unavailable',true,null)",[id])
  expect(await row()).toMatchObject({status:'dead',last_error_code:'sent_marker_failed'})
  expect(await claim()).toEqual([])
})
it('retains a verified late provider confirmation instead of leaving an accepted email retryable',async()=>{
  const id=await create();await claim()
  await db.query("update public.company_weekly_summary_queue set first_attempt_at=now()-interval '25 hours' where id=$1",[id]);await claim()
  expect((await db.query("select public.complete_company_weekly_summary($1,'provider-confirmed') ok",[id])).rows[0].ok).toBe(true)
  expect(await row()).toMatchObject({status:'sent',provider_message_id:'provider-confirmed'})
  expect(await claim()).toEqual([])
})
it('retains short backoff without restarting the clock and blocks changed generation or disabled settings',async()=>{
  const id=await create();await claim();const initial=await row()
  expect(await allowed(id,2)).toBe(false)
  await db.query("select public.fail_company_weekly_summary($1,'provider_unavailable',true,null)",[id])
  expect(await row()).toMatchObject({status:'queued',first_attempt_at:initial.first_attempt_at})
  await db.exec("update public.company_weekly_summary_queue set available_at=now();");await claim()
  await db.exec('update public.company_weekly_summary_settings set enabled=false')
  expect(await allowed(id)).toBe(false);expect((await row()).status).toBe('skipped')
})
it('denies browser roles and validates batch size',async()=>{
  for(const limit of [null,0,51])await expect(db.query('select * from public.claim_company_weekly_summary_batch($1)',[limit])).rejects.toThrow('Invalid batch size')
  const id=await create();await claim()
  for(const [user,role] of [[null,'anon'],['admin','authenticated']]){await login(db,user,role);await expect(allowed(id)).rejects.toThrow('permission denied')}
  await db.exec('reset role;set role service_role');expect(await allowed(id)).toBe(true)
})

it('starts a fresh safety window for a never-attempted old queue entry',async()=>{
  const id=await create()
  await db.query("update public.company_weekly_summary_queue set created_at=now()-interval '40 hours' where id=$1",[id])
  expect(await claim()).toHaveLength(1);expect(await allowed(id)).toBe(true)
  const job=await row();expect(new Date(job.first_attempt_at).getTime()).toBeGreaterThan(new Date(job.created_at).getTime())
})
it('never reclaims jobs with a provider ID or an exhausted attempt budget',async()=>{
  const id=await create();await claim()
  await db.query("update public.company_weekly_summary_queue set status='queued',provider_message_id='known-delivery' where id=$1",[id])
  expect(await claim()).toEqual([]);expect(await row()).toMatchObject({status:'dead',provider_message_id:'known-delivery',last_error_code:'sent_marker_failed'})
  await db.query("update public.company_weekly_summary_queue set status='queued',provider_message_id=null,attempt_count=8 where id=$1",[id])
  expect(await claim()).toEqual([]);expect((await row()).status).toBe('dead')
})
