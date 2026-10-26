import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'

let db
beforeAll(async()=>{
  db=await database()
  await db.exec(`
    alter table auth.users add column email text;
    update auth.users set email='admin@example.test' where id='${ids.admin}';
    insert into public.company_members(company_id,user_id,role,is_active) values('${ids.a}','${ids.admin}','admin',true);
    create role service_role;
    create table public.company_modules(company_id uuid,module_key text,is_enabled boolean,primary key(company_id,module_key));
    insert into public.company_modules values
      ('${ids.a}','analytics',true),('${ids.a}','crm',true),('${ids.a}','billing',true),('${ids.a}','planning',true),
      ('${ids.b}','analytics',true),('${ids.b}','crm',true),('${ids.b}','billing',true),('${ids.b}','planning',true);
    create function public.is_company_module_enabled(uuid,text) returns boolean language sql stable as $$
      select coalesce((select is_enabled from public.company_modules where company_id=$1 and module_key=$2),true)
    $$;
    create table public.lead(id uuid primary key default gen_random_uuid(),company_id uuid,created_at timestamptz default now());
    create table public.crm_pipeline_stages(id uuid primary key,company_id uuid,is_won boolean default false,is_lost boolean default false);
    create table public.crm_contacts(id uuid primary key default gen_random_uuid(),company_id uuid,stage_id uuid,created_at timestamptz default now(),next_follow_up_at timestamptz);
    create table public.analytics_daily(company_id uuid,day date,page_views integer default 0);
    create table public.billing_document_events(company_id uuid,kind text,action text,changes jsonb,created_at timestamptz default now());
    create function public.billing_safe_document_date(text) returns date language sql immutable as $$
      select case when $1 ~ '^\\d{4}-\\d{2}-\\d{2}$' then $1::date else null end
    $$;
  `)
  await db.exec(await sqlFile('migrations/WEEKLY_SUMMARY_EMAIL.sql'))
  // Existing installations may have the same signature with a legacy
  // argument name; PostgreSQL rejects CREATE OR REPLACE when that name changes.
  await db.exec(`drop function public.save_company_weekly_summary_settings(uuid,boolean,time);
    create function public.save_company_weekly_summary_settings(p_company uuid,p_enabled boolean,p_send_time time default time '09:00')
    returns public.company_weekly_summary_settings language plpgsql as $$ begin return null; end $$;
    drop function public.get_company_weekly_summary_settings(uuid);
    create function public.get_company_weekly_summary_settings(p_company uuid) returns table(active boolean) language sql as $$ select true $$;
    drop function public.claim_company_weekly_summary_batch(integer);
    create function public.claim_company_weekly_summary_batch(p_limit integer default 20) returns table(queue_id uuid) language sql as $$ select null::uuid $$;
    drop function public.get_company_weekly_summary_payload(uuid);
    create function public.get_company_weekly_summary_payload(p_queue uuid) returns table(company_id uuid,week_start date) language sql as $$ select null::uuid,null::date $$;
    create or replace function public.complete_company_weekly_summary(p_queue uuid,p_provider_id text default null)
      returns boolean language sql as $$ select true $$`)
  await db.exec(await sqlFile('migrations/WEEKLY_SUMMARY_EMAIL.sql'))
  await db.exec(await sqlFile('migrations/WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql'))
  await db.exec(await sqlFile('migrations/WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql'))
},30000)
afterAll(async()=>db?.close())

it('enables the weekly email for existing and new companies and removes user-facing settings access',async()=>{
  const settings=(await db.query('select company_id,enabled,local_send_time from public.company_weekly_summary_settings order by company_id')).rows
  expect(settings).toHaveLength(2)
  expect(settings.every(row=>row.enabled&&row.local_send_time==='09:00:00')).toBe(true)
  await login(db,'editor')
  await expect(db.query('select * from public.company_weekly_summary_settings')).rejects.toThrow()
  await expect(db.query('select * from public.company_weekly_summary_queue')).rejects.toThrow()
  await expect(db.query("select public.save_company_weekly_summary_settings($1,true,time '10:15')",[ids.a])).rejects.toThrow()
})

it('queues once on Monday after the configured hour and calculates only company-scoped aggregate counts',async()=>{
  await db.exec('reset role')
  const early=await db.query("select public.enqueue_company_weekly_summaries('2026-10-26 07:59:00+00') count")
  expect(early.rows[0].count).toBe(0)
  const first=await db.query("select public.enqueue_company_weekly_summaries('2026-10-26 08:00:00+00') count")
  const repeat=await db.query("select public.enqueue_company_weekly_summaries('2026-10-26 08:05:00+00') count")
  expect(first.rows[0].count).toBe(2)
  expect(repeat.rows[0].count).toBe(0)

  const weekStart=(await db.query("select (date_trunc('week',timestamp '2026-10-26 09:00')::date-7)::text d")).rows[0].d
  const periodStart=`${weekStart}T00:00:00+02:00`
  await db.query('insert into public.lead(company_id,created_at) values($1,$2),($3,$2)',[ids.a,periodStart,ids.b])
  await db.query('insert into public.crm_contacts(company_id,created_at,next_follow_up_at) values($1,$2,$3),($4,$2,$5)',[ids.a,periodStart,'2026-10-01T00:00:00Z',ids.b,periodStart])
  await db.query('insert into public.analytics_daily(company_id,day,page_views) values($1,$2,12),($3,$2,900)',[ids.a,weekStart,ids.b])
  await db.query("insert into public.billing_document_events(company_id,kind,action,changes,created_at) values($1,'invoice','status_changed','{\"status_after\":\"issued\"}'::jsonb,$2),($3,'invoice','status_changed','{\"status_after\":\"issued\"}'::jsonb,$2)",[ids.a,periodStart,ids.b])
  await db.exec('set role service_role')
  const jobs=(await db.query('select * from public.claim_company_weekly_summary_batch(10)')).rows
  const job=jobs.find(row=>row.company_id===ids.a)
  const summary=(await db.query('select * from public.get_company_weekly_summary_payload($1)',[job.queue_id])).rows[0]
  expect(summary).toMatchObject({company_id:ids.a,new_leads:1,new_contacts:1,overdue_followups:1,issued_invoices:1,page_views:12,recipient_emails:['admin@example.test']})
  expect(Object.keys(summary)).not.toContain('customer_name')
})

it('closes weekly queue rows after retry exhaustion',async()=>{
  await db.exec('reset role')
  await db.exec(`insert into public.company_weekly_summary_queue(company_id,week_start,status,attempt_count) values('${ids.a}','2026-10-05','queued',8)`)
  await db.query("select * from public.claim_company_weekly_summary_batch(10)")
  expect((await db.query("select status from public.company_weekly_summary_queue where week_start='2026-10-05'")).rows[0].status).toBe('dead')
})

it('initializes future companies with the automatic weekly schedule',async()=>{
  await db.exec('reset role')
  await db.query("insert into public.companies(id) values('10000000-0000-4000-8000-000000000003')")
  expect((await db.query("select enabled,local_send_time from public.company_weekly_summary_settings where company_id='10000000-0000-4000-8000-000000000003'")).rows[0]).toEqual({enabled:true,local_send_time:'09:00:00'})
})
