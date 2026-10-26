-- Módulos activables por empresa, todos habilitados por defecto.
begin;

create table if not exists public.company_modules (
  company_id uuid not null references public.companies(id) on delete cascade,
  module_key text not null check (module_key in ('items','blog','crm','planning','billing','analytics')),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key(company_id,module_key)
);

create or replace function public.is_company_module_enabled(_company_id uuid,_module_key text)
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce((select cm.is_enabled from public.company_modules cm
    where cm.company_id=_company_id and cm.module_key=_module_key),true);
$$;

insert into public.company_modules(company_id,module_key,is_enabled)
select c.id,m.module_key,true
from public.companies c
cross join unnest(array['items','blog','crm','planning','billing','analytics']::text[]) as m(module_key)
on conflict(company_id,module_key) do nothing;

create or replace function public.initialize_company_modules()
returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
begin
  insert into public.company_modules(company_id,module_key,is_enabled)
  select new.id,m.module_key,true
  from pg_catalog.unnest(array['items','blog','crm','planning','billing','analytics']::text[]) as m(module_key)
  on conflict(company_id,module_key) do nothing;
  return new;
end $$;

drop trigger if exists companies_initialize_modules on public.companies;
create trigger companies_initialize_modules after insert on public.companies
for each row execute function public.initialize_company_modules();

create or replace function public.touch_company_module()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at:=pg_catalog.now();
  new.updated_by:=auth.uid();
  return new;
end $$;
drop trigger if exists company_modules_touch_updated_at on public.company_modules;
create trigger company_modules_touch_updated_at before update on public.company_modules
for each row execute function public.touch_company_module();

-- Reminders already queued are cancelled when Planning is switched off.
-- This migration runs after PLANNING_EMAIL_QUEUE.sql.
create or replace function public.cancel_disabled_planning_reminders()
returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if new.module_key='planning' and old.is_enabled and not new.is_enabled then
    update public.planning_email_queue set status='skipped',locked_at=null,updated_at=pg_catalog.now()
    where company_id=new.company_id and status in('queued','sending');
  end if;
  return new;
end $$;
drop trigger if exists company_modules_cancel_planning_reminders on public.company_modules;
create trigger company_modules_cancel_planning_reminders after update of is_enabled on public.company_modules
for each row execute function public.cancel_disabled_planning_reminders();

-- Avoid creating reminder jobs while Planning is disabled.
create or replace function public.enqueue_due_planning_emails(p_window_minutes integer default 10)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare inserted_count integer;
begin
  if p_window_minutes is null or p_window_minutes<1 or p_window_minutes>60 then raise exception 'Invalid reminder window' using errcode='22023';end if;
  insert into public.planning_email_queue(task_id,company_id,recipient_id,minutes_before,occurrence_at)
  select d.task_id,d.company_id,d.created_by,d.minutes_before,d.occurrence_at
  from public.due_planning_reminders(p_window_minutes) d
  where d.created_by is not null and public.is_company_module_enabled(d.company_id,'planning')
  on conflict(task_id,minutes_before,occurrence_at) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

alter table public.company_modules enable row level security;
drop policy if exists company_modules_select_tenant on public.company_modules;
create policy company_modules_select_tenant on public.company_modules for select to authenticated
using(public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists company_modules_update_admin on public.company_modules;
create policy company_modules_update_admin on public.company_modules for update to authenticated
using(public.is_platform_admin() or public.has_company_role(company_id,array['admin']))
with check(public.is_platform_admin() or public.has_company_role(company_id,array['admin']));

-- Restrictive gates compose with existing tenant/role policies, so disabling a
-- module blocks direct Supabase reads/writes even if a caller bypasses the UI.
drop policy if exists items_module_gate on public.items;
create policy items_module_gate on public.items as restrictive for all to anon,authenticated
using(public.is_company_module_enabled(company_id,'items')) with check(public.is_company_module_enabled(company_id,'items'));
drop policy if exists attribute_definitions_module_gate on public.attribute_definitions;
create policy attribute_definitions_module_gate on public.attribute_definitions as restrictive for all to anon,authenticated
using(public.is_company_module_enabled(company_id,'items')) with check(public.is_company_module_enabled(company_id,'items'));
drop policy if exists attribute_values_module_gate on public.attribute_values;
create policy attribute_values_module_gate on public.attribute_values as restrictive for all to anon,authenticated
using(exists(select 1 from public.items i where i.id=attribute_values.item_id and public.is_company_module_enabled(i.company_id,'items')))
with check(exists(select 1 from public.items i where i.id=attribute_values.item_id and public.is_company_module_enabled(i.company_id,'items')));
drop policy if exists item_media_module_gate on public.item_media;
create policy item_media_module_gate on public.item_media as restrictive for all to anon,authenticated
using(exists(select 1 from public.items i where i.id=item_media.item_id and public.is_company_module_enabled(i.company_id,'items')))
with check(exists(select 1 from public.items i where i.id=item_media.item_id and public.is_company_module_enabled(i.company_id,'items')));

drop policy if exists blog_posts_module_gate on public.blog_posts;
create policy blog_posts_module_gate on public.blog_posts as restrictive for all to anon,authenticated
using(public.is_company_module_enabled(company_id,'blog')) with check(public.is_company_module_enabled(company_id,'blog'));
drop policy if exists blog_media_module_gate on public.blog_media;
create policy blog_media_module_gate on public.blog_media as restrictive for all to anon,authenticated
using(exists(select 1 from public.blog_posts p where p.id=blog_media.post_id and public.is_company_module_enabled(p.company_id,'blog')))
with check(exists(select 1 from public.blog_posts p where p.id=blog_media.post_id and public.is_company_module_enabled(p.company_id,'blog')));

drop policy if exists lead_module_gate on public.lead;
create policy lead_module_gate on public.lead as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'crm')) with check(public.is_company_module_enabled(company_id,'crm'));
drop policy if exists crm_contacts_module_gate on public.crm_contacts;
create policy crm_contacts_module_gate on public.crm_contacts as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'crm')) with check(public.is_company_module_enabled(company_id,'crm'));
drop policy if exists crm_pipeline_stages_module_gate on public.crm_pipeline_stages;
create policy crm_pipeline_stages_module_gate on public.crm_pipeline_stages as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'crm')) with check(public.is_company_module_enabled(company_id,'crm'));
drop policy if exists crm_activities_module_gate on public.crm_activities;
create policy crm_activities_module_gate on public.crm_activities as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'crm')) with check(public.is_company_module_enabled(company_id,'crm'));

drop policy if exists client_company_module_gate on public.client_company;
create policy client_company_module_gate on public.client_company as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'planning')) with check(public.is_company_module_enabled(company_id,'planning'));
drop policy if exists planning_task_module_gate on public.planning_task;
create policy planning_task_module_gate on public.planning_task as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'planning')) with check(public.is_company_module_enabled(company_id,'planning'));
drop policy if exists planning_billing_module_gate on public.billing;
create policy planning_billing_module_gate on public.billing as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'planning')) with check(public.is_company_module_enabled(company_id,'planning'));
drop policy if exists planning_task_moves_module_gate on public.planning_task_moves;
create policy planning_task_moves_module_gate on public.planning_task_moves as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'planning')) with check(public.is_company_module_enabled(company_id,'planning'));

drop policy if exists invoices_module_gate on public.invoices;
create policy invoices_module_gate on public.invoices as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists quotes_module_gate on public.quotes;
create policy quotes_module_gate on public.quotes as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists invoice_settings_module_gate on public.invoice_settings;
create policy invoice_settings_module_gate on public.invoice_settings as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists billing_payment_entries_module_gate on public.billing_payment_entries;
create policy billing_payment_entries_module_gate on public.billing_payment_entries as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists billing_document_events_module_gate on public.billing_document_events;
create policy billing_document_events_module_gate on public.billing_document_events as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists billing_drafts_module_gate on public.billing_drafts;
create policy billing_drafts_module_gate on public.billing_drafts as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists billing_draft_events_module_gate on public.billing_draft_events;
create policy billing_draft_events_module_gate on public.billing_draft_events as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists billing_draft_commits_module_gate on public.billing_draft_commits;
create policy billing_draft_commits_module_gate on public.billing_draft_commits as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists billing_color_palettes_module_gate on public.billing_color_palettes;
create policy billing_color_palettes_module_gate on public.billing_color_palettes as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists billing_catalog_items_module_gate on public.billing_catalog_items;
create policy billing_catalog_items_module_gate on public.billing_catalog_items as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
drop policy if exists billing_chapter_templates_module_gate on public.billing_chapter_templates;
create policy billing_chapter_templates_module_gate on public.billing_chapter_templates as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));

drop policy if exists analytics_event_definitions_module_gate on public.analytics_event_definitions;
create policy analytics_event_definitions_module_gate on public.analytics_event_definitions as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'analytics')) with check(public.is_company_module_enabled(company_id,'analytics'));
drop policy if exists analytics_events_module_gate on public.analytics_events;
create policy analytics_events_module_gate on public.analytics_events as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'analytics')) with check(public.is_company_module_enabled(company_id,'analytics'));
drop policy if exists analytics_daily_module_gate on public.analytics_daily;
create policy analytics_daily_module_gate on public.analytics_daily as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'analytics')) with check(public.is_company_module_enabled(company_id,'analytics'));

-- Security-definer RPCs run as the table owner and can bypass RLS. These
-- triggers keep the module switch effective for those writes as well.
create or replace function public.guard_company_module_write()
returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare target_company uuid;
begin
  target_company:=nullif(pg_catalog.to_jsonb(case when tg_op='DELETE' then old else new end)->>'company_id','')::uuid;
  if target_company is not null and not public.is_company_module_enabled(target_company,tg_argv[0])
     and not (tg_argv[0]='crm' and coalesce(pg_catalog.current_setting('app.crm_privacy_erasure',true),'')='on') then
    raise exception 'Company module is disabled' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

do $$ declare item record;
begin
  for item in select * from (values
    ('items','items'),('attribute_definitions','items'),('blog_posts','blog'),
    ('lead','crm'),('crm_contacts','crm'),('crm_pipeline_stages','crm'),('crm_activities','crm'),
    ('client_company','planning'),('planning_task','planning'),('billing','planning'),('planning_task_moves','planning'),
    ('invoices','billing'),('quotes','billing'),('invoice_settings','billing'),
    ('billing_payment_entries','billing'),('billing_document_events','billing'),
    ('billing_drafts','billing'),('billing_draft_events','billing'),('billing_draft_commits','billing'),
    ('billing_color_palettes','billing'),('billing_catalog_items','billing'),('billing_chapter_templates','billing'),
    ('analytics_event_definitions','analytics'),('analytics_events','analytics'),('analytics_daily','analytics')
  ) as modules(table_name,module_key)
  loop
    execute pg_catalog.format('drop trigger if exists guard_company_module_write on public.%I',item.table_name);
    execute pg_catalog.format('create trigger guard_company_module_write before insert or update or delete on public.%I for each row execute function public.guard_company_module_write(%L)',item.table_name,item.module_key);
  end loop;
end $$;

create or replace function public.guard_company_module_child_write()
returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare parent_company uuid; parent_id uuid; parent_table text; parent_key text;
begin
  if tg_table_name='attribute_values' or tg_table_name='item_media' then
    parent_table:='items'; parent_key:='items'; parent_id:=case when tg_op='DELETE' then old.item_id else new.item_id end;
  elsif tg_table_name='blog_media' then
    parent_table:='blog_posts'; parent_key:='blog'; parent_id:=case when tg_op='DELETE' then old.post_id else new.post_id end;
  else
    raise exception 'Unsupported module child table' using errcode='22023';
  end if;
  execute pg_catalog.format('select company_id from public.%I where id=$1',parent_table) into parent_company using parent_id;
  if parent_company is not null and not public.is_company_module_enabled(parent_company,parent_key) then
    raise exception 'Company module is disabled' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists guard_company_module_child_write on public.attribute_values;
create trigger guard_company_module_child_write before insert or update or delete on public.attribute_values for each row execute function public.guard_company_module_child_write();
drop trigger if exists guard_company_module_child_write on public.item_media;
create trigger guard_company_module_child_write before insert or update or delete on public.item_media for each row execute function public.guard_company_module_child_write();
drop trigger if exists guard_company_module_child_write on public.blog_media;
create trigger guard_company_module_child_write before insert or update or delete on public.blog_media for each row execute function public.guard_company_module_child_write();

revoke all on public.company_modules from public,anon,authenticated;
grant select,update on public.company_modules to authenticated;
revoke all on function public.initialize_company_modules() from public,anon,authenticated;
revoke all on function public.touch_company_module() from public,anon,authenticated;
revoke all on function public.cancel_disabled_planning_reminders() from public,anon,authenticated;
revoke all on function public.enqueue_due_planning_emails(integer) from public,anon,authenticated;
revoke all on function public.guard_company_module_write() from public,anon,authenticated;
revoke all on function public.guard_company_module_child_write() from public,anon,authenticated;
revoke all on function public.is_company_module_enabled(uuid,text) from public,anon,authenticated;
grant execute on function public.is_company_module_enabled(uuid,text) to anon,authenticated,service_role;
grant execute on function public.enqueue_due_planning_emails(integer) to service_role;
commit;
