import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
let db,leaked
const aggregate=(company=ids.a)=>db.query('select public.trigger_company_analytics_aggregation($1)',[company])
async function totals(){await db.exec('reset role');return (await db.query('select company_id,page_views from public.analytics_daily order by company_id')).rows}
beforeAll(async()=>{
  db=await database()
  await db.exec(`create role service_role;
    create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);
    create table public.analytics_events(company_id uuid,created_at timestamptz,event_type text,event_key text,path text,visitor text,session_id text,device text,country text,utm_source text,referrer text,lang text,value numeric);
    create table public.analytics_daily(company_id uuid,day date,unique_visitors bigint,page_views bigint,by_path jsonb,by_device jsonb,by_country jsonb,by_event jsonb,by_source jsonb,by_lang jsonb,by_scroll jsonb,by_engagement jsonb,by_not_found jsonb,primary key(company_id,day));
    alter table public.analytics_events enable row level security;
    alter table public.analytics_daily enable row level security;`)
  const members=await sqlFile('migrations/COMPANY_MEMBER_ACCESS.sql')
  await db.exec(members.slice(members.indexOf('create or replace function public.has_company_role'),members.indexOf('-- Sensitive changes')))
  const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
  const original=await sqlFile('schema/ANALYTICS_AGGREGATION.sql')
  await db.exec(original.slice(original.indexOf('create or replace function public.aggregate_analytics_rollup'),original.indexOf('-- 4) Cron:')))
  await db.query("insert into public.company_modules values($1,'analytics',true),($2,'analytics',true)",[ids.a,ids.b])
  await db.query("insert into public.analytics_events(company_id,created_at,event_type,visitor,path) values($1,now(),'page_view','visitor-a','/a'),($2,now(),'page_view','visitor-b','/b')",[ids.a,ids.b])
  await login(db,null,'anon')
  await db.query('select public.aggregate_analytics_rollup(current_date)')
  leaked=await totals()
  await db.exec('truncate public.analytics_daily')
  await db.exec(await sqlFile('migrations/ANALYTICS_RPC_SECURITY.sql'))
})
afterAll(async()=>{await db?.close()})
it('reproduces the former anonymous aggregation and denies both internal RPCs to all browser roles',async()=>{
  expect(leaked).toHaveLength(2)
  for(const [user,role] of [[null,'anon'],['editor','authenticated'],['admin','authenticated']]){
    await login(db,user,role)
    for(const sql of ['select public.aggregate_analytics_rollup(current_date)','select public.purge_old_analytics_events()']) await expect(db.query(sql)).rejects.toThrow('permission denied')
  }
  expect(await totals()).toEqual([])
})
it('denies anonymous, viewer, outsider, other-company, null and suspended requests without aggregating',async()=>{
  for(const [user,role] of [[null,'anon'],[null,'authenticated'],['viewer','authenticated'],['outsider','authenticated'],['editorB','authenticated']]){
    await login(db,user,role);await expect(aggregate()).rejects.toThrow()
  }
  await login(db,'admin');await expect(aggregate(null)).rejects.toThrow('Forbidden')
  await db.exec('reset role');await db.query('update public.company_members set is_active=false where user_id=$1',[ids.editor])
  await login(db);await expect(aggregate()).rejects.toThrow('Forbidden')
  expect(await totals()).toEqual([])
  await db.query('update public.company_members set is_active=true where user_id=$1',[ids.editor])
})
it('allows the manual button only for its company and today, with idempotent totals',async()=>{
  await login(db);await aggregate();await aggregate()
  expect(await totals()).toEqual([{company_id:ids.a,page_views:1}])
  await login(db,'editorB');await aggregate(ids.b)
  expect(await totals()).toHaveLength(2)
})
it('enforces the module switch for editors and platform administrators',async()=>{
  await db.exec('reset role');await db.query('update public.company_modules set is_enabled=false where company_id=$1',[ids.a])
  for(const user of ['editor','admin']){await login(db,user);await expect(aggregate()).rejects.toThrow('Company module is disabled')}
  await db.exec('reset role');await db.query('update public.company_modules set is_enabled=true where company_id=$1',[ids.a])
  await login(db,'admin');await aggregate()
})
it('retains owner cron and service-role maintenance while purging only expired events',async()=>{
  await db.exec('reset role')
  await db.query("insert into public.analytics_events(company_id,created_at,event_type) values($1,now()-interval '36 days','page_view')",[ids.a])
  await db.exec('select public.aggregate_analytics_rollup(current_date); select public.purge_old_analytics_events();')
  await db.exec('set role service_role; select public.aggregate_analytics_rollup(current_date); select public.purge_old_analytics_events(); reset role;')
  expect((await db.query('select count(*)::int n from public.analytics_events')).rows[0].n).toBe(2)
})
