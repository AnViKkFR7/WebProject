import { afterAll, beforeAll, expect, it } from 'vitest'
import { database, ids, login, save, sqlFile } from './helpers'

let db
beforeAll(async () => {
  db = await database()
  await db.exec(`
    create role service_role;
    create table public.attribute_values(id uuid primary key default gen_random_uuid(), item_id uuid not null);
    create table public.item_media(id uuid primary key default gen_random_uuid(), item_id uuid not null);
    create table public.blog_media(id uuid primary key default gen_random_uuid(), post_id uuid not null);
    create table public.blog_posts(id uuid primary key default gen_random_uuid(), company_id uuid not null, status text default 'draft');
    create table public.items(id uuid primary key default gen_random_uuid(), company_id uuid not null, status text default 'draft');
    create table public.attribute_definitions(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.lead(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.crm_contacts(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.crm_pipeline_stages(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.crm_activities(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.planning_task_moves(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.planning_email_queue(id uuid primary key default gen_random_uuid(),company_id uuid not null,status text not null default 'queued',locked_at timestamptz,updated_at timestamptz not null default now());
    create table public.billing_payment_entries(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.billing_document_events(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.billing_drafts(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.billing_draft_events(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.billing_draft_commits(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.billing_color_palettes(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.billing_catalog_items(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.billing_chapter_templates(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.analytics_event_definitions(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.analytics_events(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    create table public.analytics_daily(id uuid primary key default gen_random_uuid(), company_id uuid not null);
    alter table public.items enable row level security;
    create policy items_tenant_test on public.items for all to authenticated using(public.is_company_member(company_id)) with check(public.has_company_role(company_id,array['admin','editor']));
    alter table public.blog_posts enable row level security;
    create policy blog_tenant_test on public.blog_posts for all to authenticated using(public.is_company_member(company_id)) with check(public.has_company_role(company_id,array['admin','editor']));
    grant select,insert,update,delete on public.items,public.blog_posts to authenticated;
    alter table public.crm_contacts enable row level security;
    alter table public.company_members enable row level security;
    grant update on public.company_members to authenticated;
    update public.company_members set role='admin' where company_id='10000000-0000-4000-8000-000000000001' and user_id='20000000-0000-4000-8000-000000000001';
  `)
  await db.exec(await sqlFile('migrations/COMPANY_MODULES.sql'))
  await db.exec(await sqlFile('migrations/COMPANY_MODULES.sql'))
  await db.exec(await sqlFile('migrations/COMPANY_MODULES_PLATFORM_ADMIN.sql'))
  await db.exec(await sqlFile('migrations/COMPANY_MODULES_PLATFORM_ADMIN.sql'))
  await db.exec(`create function public.test_privacy_module_write(p_company uuid,p_contact uuid) returns void language plpgsql security definer set search_path='' as $$ begin perform pg_catalog.set_config('app.crm_privacy_erasure','on',true);if coalesce(pg_catalog.current_setting('app.crm_privacy_erasure',true),'')<>'on' then raise exception 'test context missing';end if;delete from public.crm_contacts where company_id=p_company and id=p_contact;end $$`)
}, 30000)
afterAll(async () => db?.close())

it('starts all companies with all modules enabled and seeds companies created later', async () => {
  const { rows } = await db.query('select module_key,is_enabled from public.company_modules where company_id=$1 order by module_key', [ids.a])
  expect(rows).toHaveLength(6)
  expect(rows.every(row => row.is_enabled)).toBe(true)
  await db.query("insert into public.companies(id) values('10000000-0000-4000-8000-000000000003')")
  expect((await db.query("select count(*)::int as count from public.company_modules where company_id='10000000-0000-4000-8000-000000000003'")).rows[0].count).toBe(6)
})

it('allows only the platform admin to change module settings', async () => {
  await login(db)
  await expect(db.query("select public.set_company_module($1,'blog',false)", [ids.a])).rejects.toThrow('Forbidden')
  await expect(db.query("update public.company_modules set is_enabled=false where company_id=$1 and module_key='blog'", [ids.a])).rejects.toThrow()
  expect((await db.query("select is_enabled from public.company_modules where company_id=$1 and module_key='blog'", [ids.a])).rows[0].is_enabled).toBe(true)

  await login(db, 'admin')
  await db.query("select public.set_company_module($1,'blog',false)", [ids.a])
  expect((await db.query("select is_enabled from public.company_modules where company_id=$1 and module_key='blog'", [ids.a])).rows[0].is_enabled).toBe(false)

  await login(db, 'viewer')
  await expect(db.query("select public.set_company_module($1,'blog',true)", [ids.a])).rejects.toThrow('Forbidden')
  expect((await db.query("select is_enabled from public.company_modules where company_id=$1 and module_key='blog'", [ids.a])).rows[0].is_enabled).toBe(false)
})

it('hides disabled content from direct reads and denies direct and security-definer writes', async () => {
  await login(db)
  await db.query("insert into public.items(company_id,status) values($1,'draft')", [ids.a])
  await save(db, ids.a)
  await login(db, 'admin')
  await db.query("select public.set_company_module($1,'items',false)", [ids.a])
  await db.query("select public.set_company_module($1,'billing',false)", [ids.a])
  await login(db)
  expect((await db.query('select * from public.items')).rows).toHaveLength(0)
  expect((await db.query('select * from public.invoices')).rows).toHaveLength(0)
  await expect(db.query("insert into public.items(company_id) values($1)", [ids.a])).rejects.toThrow()
  await expect(save(db, ids.a)).rejects.toThrow('Company module is disabled')
})

it('blocks public form inserts if CRM is disabled, while keeping tenant defaults enabled', async () => {
  await login(db)
  await expect(db.query("select public.set_company_module($1,'crm',false)", [ids.a])).rejects.toThrow('Forbidden')
  await login(db, 'admin')
  await db.query("select public.set_company_module($1,'crm',false)", [ids.a])
  expect((await db.query("select is_enabled from public.company_modules where company_id=$1 and module_key='crm'", [ids.a])).rows[0].is_enabled).toBe(false)
  expect((await db.query("select tgname from pg_trigger where tgrelid='public.lead'::regclass and tgname='guard_company_module_write' and not tgisinternal")).rows).toHaveLength(1)
  await db.exec('reset role')
  expect((await db.query("select public.is_company_module_enabled($1,'crm') as enabled, current_setting('app.crm_privacy_erasure',true) as bypass", [ids.a])).rows[0]).toEqual({enabled:false,bypass:null})
  await expect(db.query("insert into public.lead(company_id) values($1)", [ids.a])).rejects.toThrow('Company module is disabled')
})

it('skips queued Planning reminders when that company disables the module', async () => {
  await db.query("insert into public.planning_email_queue(company_id) values($1)", [ids.a])
  await login(db, 'admin')
  await db.query("select public.set_company_module($1,'planning',false)", [ids.a])
  expect((await db.query('select status from public.planning_email_queue where company_id=$1', [ids.a])).rows[0].status).toBe('skipped')
})

it('keeps an authorized privacy deletion possible while CRM is disabled', async () => {
  await db.exec('reset role')
  await db.query("update public.company_modules set is_enabled=true where company_id=$1 and module_key='crm'", [ids.a])
  const { rows: [contact] } = await db.query('insert into public.crm_contacts(company_id) values($1) returning id', [ids.a])
  await login(db)
  await login(db, 'admin')
  await db.query("select public.set_company_module($1,'crm',false)", [ids.a])
  await login(db)
  await db.query('delete from public.crm_contacts where id=$1', [contact.id])
  await db.exec('reset role')
  expect((await db.query('select id from public.crm_contacts where id=$1', [contact.id])).rows).toHaveLength(1)
  await db.query('select public.test_privacy_module_write($1,$2)', [ids.a, contact.id])
  expect((await db.query('select id from public.crm_contacts where id=$1', [contact.id])).rows).toHaveLength(0)
})
