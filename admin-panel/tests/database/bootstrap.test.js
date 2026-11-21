import {PGlite} from '@electric-sql/pglite'
import {afterAll,beforeAll,expect,it} from 'vitest'
import {loadBootstrap} from '../../../scripts/build-database-bootstrap.mjs'
import {ids,document,login,save} from './helpers'
let db,steps
beforeAll(async()=>{
 db=new PGlite()
 // Only the platform contract is modeled here; no application tables/helpers.
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email varchar,email_confirmed_at timestamptz,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid);
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to anon,authenticated;`)
 steps=(await loadBootstrap()).steps
 for(const step of steps){
  try{await db.exec(step.sql)}catch(error){throw new Error(`Bootstrap failed at ${step.path}: ${error.message}`,{cause:error})}
 }
 for(const key of ['editor','viewer','editorB','admin'])await db.query('insert into auth.users(id,email) values($1,$2)',[ids[key],`${key}@example.test`])
 for(const company of ['a','b'])await db.query("insert into public.companies(id,name,contact_email,contact_phone,created_by) values($1,$2,'company@example.test','600000000',$3)",[ids[company],company,ids.admin])
 for(const [company,user,role] of [['a','editor','editor'],['a','viewer','viewer'],['a','admin','admin'],['b','editorB','editor']])await db.query('insert into public.company_members(company_id,user_id,role) values($1,$2,$3)',[ids[company],ids[user],role])
},60000)
afterAll(async()=>db?.close())
it('creates the actual application from the platform-only fixture',async()=>{
 const tables=(await db.query("select tablename from pg_tables where schemaname='public'")).rows.map(r=>r.tablename)
 for(const table of ['companies','client_company','planning_task','billing','attached_file','client_company_members','invoices','quotes','company_modules','company_weekly_summary_queue','item_storage_cleanup_queue'])expect(tables).toContain(table)
})
it('refuses to bootstrap an existing application',async()=>{
 await expect(db.exec(steps[0].sql)).rejects.toThrow('empty public schema')
})
it('refuses a missing Supabase platform before creating any application table',async()=>{
 const empty=new PGlite()
 try{
  await expect(empty.exec(steps[0].sql)).rejects.toThrow('Initialize Supabase Auth and Storage')
  expect((await empty.query("select tablename from pg_tables where schemaname='public'")).rows).toEqual([])
 }finally{await empty.close()}
})
it('preserves existing application functions even if there are no public tables',async()=>{
 const existing=new PGlite()
 try{
  await existing.exec('create function public.existing_application() returns int language sql as $$select 42$$')
  await expect(existing.exec(steps[0].sql)).rejects.toThrow('empty public schema')
  expect((await existing.query('select public.existing_application() n')).rows[0].n).toBe(42)
 }finally{await existing.close()}
})
it('supports real fiscal issuance and prevents direct writes or foreign-company access',async()=>{
 await login(db)
 const invoice=await save(db,ids.a,document(),'issued')
 expect(invoice.number).toBeTruthy()
 const financials=(await db.query('select * from public.get_invoice_financials($1)',[ids.a])).rows
 expect(Number(financials.find(row=>row.invoice_id===invoice.id).balance)).toBe(121)
 await expect(db.query("update public.invoices set status='draft' where id=$1",[invoice.id])).rejects.toThrow('permission denied')
 await login(db,'editorB')
 expect((await db.query('select * from public.invoices where company_id=$1',[ids.a])).rows).toEqual([])
 await expect(db.query('select * from public.get_invoice_financials($1)',[ids.a])).rejects.toThrow('Forbidden')
 await login(db,'viewer');await expect(save(db)).rejects.toThrow('Forbidden')
})
it('supports the shared directory with billing alone but leaves Planning blocked',async()=>{
 await db.exec('reset role');await db.query("update public.company_modules set is_enabled=false where company_id=$1 and module_key='planning'",[ids.a])
 await login(db)
 const client=(await db.query("select * from public.save_client_company($1,null,'Customer','','','','','','#1976d2')",[ids.a])).rows[0]
 expect((await db.query('select * from public.client_company where id=$1',[client.id])).rows).toHaveLength(1)
 expect((await db.query('select public.can_access_planner_object($1,true) ok',[`${ids.a}/test.pdf`])).rows[0].ok).toBe(false)
 await db.exec('reset role');await db.query("update public.company_modules set is_enabled=true where company_id=$1 and module_key='planning'",[ids.a])
})
it('keeps queue helpers, legacy tables and TRUNCATE unavailable to browser roles',async()=>{
 for(const [user,role] of [['editor','authenticated'],[null,'anon']]){
  await login(db,user,role)
  for(const table of ['attached_file','client_company_members','item_storage_cleanup_queue','company_weekly_summary_queue']){
   await expect(db.query(`select * from public.${table}`)).rejects.toThrow('permission denied')
  }
  await expect(db.exec('truncate public.items cascade')).rejects.toThrow('permission denied')
  await expect(db.query('select * from public.claim_item_storage_cleanup(1)')).rejects.toThrow('permission denied')
 }
})
it('provides browser grants for preferences and analytics without granting ingestion',async()=>{
 await login(db)
 await db.query("insert into public.user_filter_preferences(user_id,page,filter_config) values($1,'items','{}')",[ids.editor])
 await db.query("insert into public.analytics_event_definitions(company_id,key,label) values($1,'contact-click','Contact')",[ids.a])
 await expect(db.query("insert into public.analytics_events(company_id,path,event_type) values($1,'/','page_view')",[ids.a])).rejects.toThrow('permission denied')
 await login(db,'editorB')
 expect((await db.query('select * from public.user_filter_preferences')).rows).toEqual([])
 expect((await db.query('select * from public.analytics_event_definitions where company_id=$1',[ids.a])).rows).toEqual([])
})
it('runs final weekly payload with Supabase varchar emails without installing Watch helpers',async()=>{
 await db.exec('reset role')
 await db.query("insert into public.company_weekly_summary_queue(company_id,week_start) values($1,'2026-10-19')",[ids.a])
 const job=(await db.query('select * from public.claim_company_weekly_summary_batch(1)')).rows[0]
 const payload=(await db.query('select * from public.get_company_weekly_summary_payload($1)',[job.queue_id])).rows[0]
 expect(payload.recipient_emails).toEqual(['admin@example.test'])
 expect((await db.query("select to_regprocedure('public.claim_watch_weekly_summary_test(uuid)') absent")).rows[0].absent).toBeNull()
})
it('runs Planning moves and isolates private Planner objects by company',async()=>{
 await login(db)
 const task=(await db.query("insert into public.planning_task(company_id,title,start_datetime,created_by) values($1,'Task','2026-11-01 09:00+01',$2) returning *",[ids.a,ids.editor])).rows[0]
 await db.query("select public.move_planning_task($1,$2,$3,'2026-11-02 09:00+01',null)",[ids.a,task.id,task.version])
 expect((await db.query('select version from public.planning_task where id=$1',[task.id])).rows[0].version).toBe(2)
 await db.query("insert into storage.objects(bucket_id,name) values('media-planner',$1)",[`${ids.a}/file.pdf`])
 await expect(db.query("insert into storage.objects(bucket_id,name) values('media-planner',$1)",[`${ids.b}/file.pdf`])).rejects.toThrow('row-level security')
 await login(db,'editorB');expect((await db.query('select * from storage.objects')).rows).toEqual([])
})
it('keeps draft media private after composing all historical and restrictive policies',async()=>{
 await db.exec('reset role')
 const draft='30000000-0000-4000-8000-000000000001',published='30000000-0000-4000-8000-000000000002'
 await db.query("insert into public.items(id,company_id,title,item_type) values($1,$2,'Private item','property'),($3,$4,'Public item','property')",[draft,ids.a,published,ids.b])
 for(const [item,label] of [[draft,'private'],[published,'public']])await db.query("insert into public.item_media(item_id,file_type,url_externa,is_cover) values($1,'image',$2,true)",[item,`https://example.test/${label}.png`])
 await db.query("update public.items set status='published' where id=$1",[published])
 await login(db,null,'anon')
 expect((await db.query('select item_id from public.item_media')).rows.map(r=>r.item_id)).toEqual([published])
 expect((await db.query('select item_id from public.item_media_summary')).rows.map(r=>r.item_id)).toEqual([published])
 await login(db)
 expect((await db.query('select item_id from public.item_media order by item_id')).rows.map(r=>r.item_id)).toEqual([draft,published])
})
