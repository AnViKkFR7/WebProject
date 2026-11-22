import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'

let db,seed
const seedId=(table,n)=>db.query("select md5($1||'watch-manual-v1:'||$2||':'||$3)::uuid id",[ids.a,table,String(n)]).then(r=>r.rows[0].id)
const counts=()=>db.query(`select
  (select count(*)::int from public.lead) leads,
  (select count(*)::int from public.crm_contacts) contacts,
  (select count(*)::int from public.analytics_events) events,
  (select count(*)::int from public.billing_payment_entries) payments,
  (select count(*)::int from public.invoices) invoices,
  (select count(*)::int from public.quotes) quotes,
  (select count(*)::int from public.planning_task) tasks,
  (select count(*)::int from public.blog_posts) posts,
  (select count(*)::int from public.billing_document_events) history`).then(r=>r.rows[0])

beforeAll(async()=>{
  db=await database()
  await db.exec(`create role service_role;
    alter table public.companies add column name text;
    update public.companies set name=case when id='${ids.a}' then 'WatchEcommerceDemo' else 'Another company' end;
    alter table public.company_members add constraint company_member_unique unique(company_id,user_id);
    insert into public.company_members(company_id,user_id,role) values('${ids.a}','${ids.admin}','admin');
    alter table public.planning_task add column title text not null default '',add column description text,
      add column type text check(type in('recibir_pago','realizar_pago','todo','entregable','reunion')),
      add column end_datetime timestamptz,add column created_by uuid references auth.users(id),
      add column is_all_day boolean default false,add column recurrence_type text default 'none',
      add column reminders integer[] not null default '{}';
    alter table public.billing add column title text not null default '',add column description text,
      add column amount numeric not null default 0,add column direction text check(direction in('pagar','cobrar')),
      add column recurrence_type text default 'none',add column created_by uuid references auth.users(id);
    create function public.set_audit_fields() returns trigger language plpgsql as $$begin
      new.created_by:=coalesce(new.created_by,auth.uid());new.last_edited_by:=auth.uid();return new;end$$;
    create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at:=now();return new;end$$;
  `)
  const schema=await sqlFile('schema/BDD_REFERENCIA.sql')
  const blog=schema.slice(schema.indexOf('CREATE TABLE public.blog_posts ('),schema.indexOf('CREATE TABLE public.blog_media ('))
  await db.exec(blog)
  // En producción la columna la añade CONTENT_SEO_FIELDS.sql; el esquema de referencia es anterior.
  await db.exec('alter table public.blog_posts add column slug text')
  for(const f of ['BILLING_SECURITY_HARDENING','BILLING_DOCUMENT_PRESENTATION','BILLING_APPEARANCE',
    'BILLING_DIRECTORY_CATALOG','BILLING_CHAPTER_TEMPLATES','BILLING_PAYMENTS_HISTORY',
    'BILLING_ISSUED_INVOICE_LOCK','BILLING_RECTIFYING_INVOICES'])await db.exec(await sqlFile(`migrations/${f}.sql`))
  await db.exec(await sqlFile('schema/LEADS_SCHEMA.sql'))
  for(const f of ['CRM_CONTACTS_PIPELINE','CRM_LEAD_ITEM_ATTRIBUTION','CRM_BILLING_LINKS',
    'BILLING_QUOTE_APPROVAL','BILLING_QUOTE_APPROVAL_REVISIONS'])await db.exec(await sqlFile(`migrations/${f}.sql`))
  await db.exec(`create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);
    insert into public.company_modules select '${ids.a}'::uuid,k,true from unnest(array['crm','planning','billing','analytics','blog']) k;`)
  const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
  await db.exec(await sqlFile('migrations/BILLING_DUE_REMINDERS.sql'))
  await db.exec(await sqlFile('schema/ANALYTICS_SCHEMA.sql'))
  await db.exec(`alter table public.analytics_events add column visitor text,add column lang text,add column referrer text,
    add column utm_source text,add column utm_medium text,add column utm_campaign text;
    alter table public.analytics_events alter column session_id drop not null;
    alter table public.analytics_daily add column by_source jsonb default '{}',add column by_lang jsonb default '{}';`)
  await db.exec(await sqlFile('migrations/ANALYTICS_ENGAGEMENT.sql'))
  const aggregate=await sqlFile('schema/ANALYTICS_AGGREGATION.sql')
  await db.exec(aggregate.slice(aggregate.indexOf('create or replace function public.aggregate_analytics_rollup'),aggregate.indexOf('-- 4) Cron:')))
  await db.exec(await sqlFile('migrations/ANALYTICS_RPC_SECURITY.sql'))
  // Keep real pre-existing rows in BOTH tenants while seeding. This catches
  // accidental global deletes as well as aggregation that drops organic data.
  await db.query(`insert into public.analytics_events(company_id,event_type,path,session_id,visitor,created_at)
    values($1,'page_view','/existing-a','organic-a','existing-a',now()),
          ($2,'page_view','/existing-b','organic-b','existing-b',now())`,[ids.a,ids.b])
  await db.query("select public.aggregate_analytics_rollup(current_date,$1)",[ids.b])
  seed=await sqlFile('maintenance/WATCH_MANUAL_DEMO_DATA.sql')
},30000)
afterAll(async()=>db?.close())

it('rejects a missing/ambiguous demo company before inserting anything',async()=>{
  const before=await counts()
  await db.query('update public.companies set name=$1 where id=$2',['Different name',ids.a])
  await expect(db.exec(seed)).rejects.toThrow('exactamente una empresa')
  await db.exec('rollback')
  expect(await counts()).toEqual(before)
  await db.query('update public.companies set name=$1',['WatchEcommerceDemo'])
  await expect(db.exec(seed)).rejects.toThrow('exactamente una empresa')
  await db.exec('rollback')
  await db.query('update public.companies set name=$1 where id=$2',['Another company',ids.b])
})

it('rejects cross-company ID collisions and rolls back the entire transaction',async()=>{
  const id=await seedId('contact',1)
  const stage=(await db.query("select id from public.crm_pipeline_stages where company_id=$1 and stage_key='new'",[ids.b])).rows[0].id
  await db.query('insert into public.crm_contacts(id,company_id,name,stage_id) values($1,$2,$3,$4)',[id,ids.b,'Other tenant contact',stage])
  const before=await counts()
  await expect(db.exec(seed)).rejects.toThrow('Colisión de IDs')
  await db.exec('rollback');expect(await counts()).toEqual(before)
  await db.query('delete from public.crm_contacts where id=$1 and company_id=$2',[id,ids.b])
})

it('requires an active administrator and enabled modules',async()=>{
  await db.query('update public.company_members set is_active=false where company_id=$1 and role=$2',[ids.a,'admin'])
  await expect(db.exec(seed)).rejects.toThrow('administrador activo');await db.exec('rollback')
  await db.query('update public.company_members set is_active=true where company_id=$1',[ids.a])
  await db.query("update public.company_modules set is_enabled=false where company_id=$1 and module_key='analytics'",[ids.a])
  await expect(db.exec(seed)).rejects.toThrow('Activa los módulos');await db.exec('rollback')
  await db.query('update public.company_modules set is_enabled=true where company_id=$1',[ids.a])
})

it('creates consistent demo workflows and analytics using real migrations/RPCs',async()=>{
  await db.exec(seed)
  expect(await counts()).toMatchObject({leads:12,contacts:8,invoices:5,quotes:4,tasks:10,posts:2,payments:2})
  // Con slug: sin él una web no mostraría el artículo y el panel lo marca como «Sin dirección».
  expect((await db.query('select slug from public.blog_posts order by slug')).rows.map(r=>r.slug)).toEqual(['como-elegir-tu-primer-reloj-automatico','cuidar-un-reloj-vintage-cinco-habitos-sencillos'])
  expect((await db.query("select count(*)::int n from public.lead where crm_match_state='linked'")).rows[0].n).toBe(12)
  const status=(await db.query('select status from public.quotes order by created_at')).rows.map(r=>r.status)
  expect(status).toEqual(expect.arrayContaining(['draft','sent','accepted','rejected']))
  expect((await db.query('select count(*)::int n from public.quote_approval_responses')).rows[0].n).toBe(2)
  expect((await db.query('select count(*)::int n from public.quote_approval_links where resolved_at is null and revoked_at is null')).rows[0].n).toBe(0)
  const totals=(await db.query('select count(*)::int days,sum(page_views)::int views from public.analytics_daily where company_id=$1',[ids.a])).rows[0]
  expect(totals.days).toBe(30);expect(totals.views).toBeGreaterThan(1500)
  expect(totals.views).toBe((await db.query("select count(*)::int n from public.analytics_events where event_type='page_view' and company_id=$1",[ids.a])).rows[0].n)
  for(const table of ['lead','crm_contacts','crm_activities','client_company','planning_task','billing_catalog_items',
    'billing_chapter_templates','invoices','quotes','analytics_events','analytics_daily','blog_posts','crm_billing_links']){
    expect((await db.query(`select count(*)::int n from public.${table} where company_id=$1`,[ids.b])).rows[0].n,table).toBe(['analytics_events','analytics_daily'].includes(table)?1:0)
  }
  expect((await db.query("select page_views from public.analytics_daily where company_id=$1",[ids.b])).rows[0].page_views).toBe(1)
  expect((await db.query("select by_path->>'/existing-a' n from public.analytics_daily where company_id=$1 and day=current_date",[ids.a])).rows[0].n).toBe('1')
  expect((await db.query('select count(*)::int n from public.billing where company_id=$1',[ids.a])).rows[0].n).toBe(4)
},30000)

it('is repeatable without duplicates or overwriting edits, and does not enqueue customer emails',async()=>{
  const contact=await seedId('contact',1)
  await db.query('update public.crm_contacts set name=$1 where company_id=$2 and id=$3',['Edited by the user',ids.a,contact])
  const before=await counts();await db.exec(seed);expect(await counts()).toEqual(before)
  expect((await db.query('select name from public.crm_contacts where id=$1',[contact])).rows[0].name).toBe('Edited by the user')
  expect((await db.query('select count(*)::int n from public.planning_task where cardinality(reminders)>0')).rows[0].n).toBe(0)
  expect((await db.query('select count(*)::int n from public.billing_invoice_reminder_preferences where not suppressed')).rows[0].n).toBe(0)
  await db.query('select public.enqueue_billing_due_reminders()')
  expect((await db.query('select count(*)::int n from public.billing_due_reminder_queue')).rows[0].n).toBe(0)
},30000)

it('keeps seeded data inaccessible to the other tenant through the actual RLS policies',async()=>{
  await login(db,'editorB')
  for(const table of ['lead','crm_contacts','crm_activities','client_company','planning_task','invoices','quotes','analytics_daily']){
    expect((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n,table).toBe(table==='analytics_daily'?1:0)
  }
  await db.exec('reset role')
})
