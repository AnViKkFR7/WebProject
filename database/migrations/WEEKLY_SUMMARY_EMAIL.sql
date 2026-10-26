-- Weekly operational summary, aggregate-only and disabled until an admin opts in.
-- Apply after COMPANY_MODULES.sql, CRM_CONTACTS_PIPELINE.sql,
-- BILLING_PAYMENTS_HISTORY.sql, BILLING_DUE_REMINDERS.sql, INVOICING.sql,
-- QUOTES.sql and PLANNING_SCHEMA.sql.
begin;

create table if not exists public.company_weekly_summary_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  local_send_time time not null default time '09:00',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.company_weekly_summary_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  week_start date not null,
  status text not null default 'queued' check(status in('queued','sending','sent','dead','skipped')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  delivery_generation integer not null default 1 check(delivery_generation>0),
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

-- The local schema snapshot already contains these two tables. Complete older
-- installations safely without changing or dropping existing records.
alter table public.company_weekly_summary_settings
  add column if not exists enabled boolean not null default false,
  add column if not exists local_send_time time not null default time '09:00',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.company_weekly_summary_queue
  add column if not exists status text not null default 'queued',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists delivery_generation integer not null default 1,
  add column if not exists provider_message_id text,
  add column if not exists last_error_code text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists sent_at timestamptz;
do $$ begin
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.company_weekly_summary_queue'::regclass and conname='company_weekly_summary_queue_company_week_key') then
    alter table public.company_weekly_summary_queue add constraint company_weekly_summary_queue_company_week_key unique(company_id,week_start);
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.company_weekly_summary_queue'::regclass and conname='company_weekly_summary_queue_status_check') then
    alter table public.company_weekly_summary_queue add constraint company_weekly_summary_queue_status_check check(status in('queued','sending','sent','dead','skipped'));
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.company_weekly_summary_queue'::regclass and conname='company_weekly_summary_queue_attempt_count_check') then
    alter table public.company_weekly_summary_queue add constraint company_weekly_summary_queue_attempt_count_check check(attempt_count>=0);
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.company_weekly_summary_queue'::regclass and conname='company_weekly_summary_queue_delivery_generation_check') then
    alter table public.company_weekly_summary_queue add constraint company_weekly_summary_queue_delivery_generation_check check(delivery_generation>0);
  end if;
end $$;
create index if not exists company_weekly_summary_ready_idx
  on public.company_weekly_summary_queue(available_at,created_at) where status in('queued','sending');
create index if not exists company_weekly_summary_history_idx
  on public.company_weekly_summary_queue(company_id,created_at desc);

alter table public.company_weekly_summary_settings enable row level security;
alter table public.company_weekly_summary_queue enable row level security;
revoke all on public.company_weekly_summary_settings,public.company_weekly_summary_queue from public,anon,authenticated;
grant select on public.company_weekly_summary_settings to authenticated;
grant select on public.company_weekly_summary_queue to authenticated;
grant select,insert,update on public.company_weekly_summary_queue to service_role;
drop policy if exists weekly_summary_settings_read on public.company_weekly_summary_settings;
create policy weekly_summary_settings_read on public.company_weekly_summary_settings for select to authenticated
  using(public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists weekly_summary_queue_read on public.company_weekly_summary_queue;
create policy weekly_summary_queue_read on public.company_weekly_summary_queue for select to authenticated
  using(public.is_platform_admin() or public.is_company_member(company_id));

-- These RPCs return OUT columns. Older versions returned a different row
-- shape, which PostgreSQL cannot replace in place. Drop/recreate them inside
-- this transaction so callers see either the old schema or the complete new one.
drop function if exists public.get_company_weekly_summary_settings(uuid);
create function public.get_company_weekly_summary_settings(p_company uuid)
returns table(enabled boolean,local_send_time time)
language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if not (public.is_platform_admin() or public.has_company_role(p_company,array['admin'])) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  return query select s.enabled,s.local_send_time from public.company_weekly_summary_settings s where s.company_id=p_company;
  if not found then return query select false,time '09:00'; end if;
end $$;

-- Older deployments used the same argument types but called the third
-- parameter p_send_time. PostgreSQL cannot rename an input parameter with
-- CREATE OR REPLACE, so drop this RPC before recreating it with the current
-- name. Its grants are restored below.
drop function if exists public.save_company_weekly_summary_settings(uuid,boolean,time);
create function public.save_company_weekly_summary_settings(p_company uuid,p_enabled boolean,p_local_send_time time default time '09:00')
returns public.company_weekly_summary_settings
language plpgsql security definer set search_path='' set row_security=off as $$
declare result public.company_weekly_summary_settings;
begin
  if not (public.is_platform_admin() or public.has_company_role(p_company,array['admin'])) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_local_send_time is null then raise exception 'Invalid send time' using errcode='22023'; end if;
  insert into public.company_weekly_summary_settings(company_id,enabled,local_send_time,updated_by)
  values(p_company,coalesce(p_enabled,false),p_local_send_time,auth.uid())
  on conflict(company_id) do update set enabled=excluded.enabled,local_send_time=excluded.local_send_time,updated_at=pg_catalog.now(),updated_by=auth.uid()
  returning * into result;
  if not result.enabled then
    update public.company_weekly_summary_queue set status='skipped',locked_at=null,updated_at=pg_catalog.now(),last_error_code='disabled'
    where company_id=p_company and status in('queued','sending');
  else
    update public.company_weekly_summary_queue q set
      available_at=((q.week_start+7)+p_local_send_time) at time zone 'Europe/Madrid',updated_at=pg_catalog.now()
    where q.company_id=p_company and q.week_start=(date_trunc('week',pg_catalog.now() at time zone 'Europe/Madrid')::date-7) and q.status='queued';
  end if;
  return result;
end $$;

create or replace function public.enqueue_company_weekly_summaries(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path='' set row_security=off as $$
declare local_now timestamp; week_to_summarize date; inserted_count integer;
begin
  local_now:=p_now at time zone 'Europe/Madrid';
  if extract(isodow from local_now)<>1 then return 0; end if;
  week_to_summarize:=(date_trunc('week',local_now)::date-7);
  insert into public.company_weekly_summary_queue(company_id,week_start,available_at)
  select s.company_id,week_to_summarize,(date_trunc('week',local_now)::date+s.local_send_time) at time zone 'Europe/Madrid' from public.company_weekly_summary_settings s
  where s.enabled and s.local_send_time<=local_now::time
  on conflict(company_id,week_start) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

drop function if exists public.claim_company_weekly_summary_batch(integer);
create function public.claim_company_weekly_summary_batch(p_limit integer default 20)
returns table(queue_id uuid,company_id uuid,week_start date,delivery_generation integer)
language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if p_limit<1 or p_limit>50 then raise exception 'Invalid batch size' using errcode='22023'; end if;
  update public.company_weekly_summary_queue set status='dead',locked_at=null,last_error_code='unexpected_failure',updated_at=now()
    where attempt_count>=8 and (status='queued' or (status='sending' and locked_at<now()-interval '20 hours'));
  return query with claimed as (
    select q.id from public.company_weekly_summary_queue q
    where ((q.status='queued' and q.available_at<=now())
       or (q.status='sending' and q.locked_at<now()-interval '20 hours'))
      and q.attempt_count<8
    order by q.available_at,q.created_at for update skip locked limit p_limit
  ) update public.company_weekly_summary_queue q set status='sending',locked_at=now(),attempt_count=q.attempt_count+1,updated_at=now()
    from claimed c where q.id=c.id and q.attempt_count<8
    returning q.id,q.company_id,q.week_start,q.delivery_generation;
end $$;

drop function if exists public.get_company_weekly_summary_payload(uuid);
create function public.get_company_weekly_summary_payload(p_queue uuid)
returns table(company_id uuid,week_start date,week_end date,recipient_emails text[],new_leads integer,new_contacts integer,overdue_followups integer,issued_invoices integer,overdue_invoices integer,quotes_waiting integer,upcoming_planning integer,page_views integer)
language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_weekly_summary_queue; period_start timestamptz; period_end timestamptz; local_today date;
begin
  select * into q from public.company_weekly_summary_queue where id=p_queue and status='sending' and locked_at>now()-interval '20 hours';
  if not found then return; end if;
  if not exists(select 1 from public.company_weekly_summary_settings s where s.company_id=q.company_id and s.enabled) then
    update public.company_weekly_summary_queue set status='skipped',locked_at=null,last_error_code='disabled',updated_at=now() where id=p_queue;
    return;
  end if;
  period_start:=q.week_start::timestamp at time zone 'Europe/Madrid';
  period_end:=(q.week_start+7)::timestamp at time zone 'Europe/Madrid';
  local_today:=(now() at time zone 'Europe/Madrid')::date;
  return query select q.company_id,q.week_start,q.week_start+6,
    coalesce((select array_agg(distinct u.email order by u.email) from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=q.company_id and m.role='admin' and m.is_active and nullif(btrim(u.email),'') is not null),array[]::text[]),
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.lead l where l.company_id=q.company_id and l.created_at>=period_start and l.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.crm_contacts c where c.company_id=q.company_id and c.created_at>=period_start and c.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.crm_contacts c left join public.crm_pipeline_stages s on s.id=c.stage_id and s.company_id=c.company_id where c.company_id=q.company_id and c.next_follow_up_at<now() and not coalesce(s.is_won,false) and not coalesce(s.is_lost,false)) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.billing_document_events e where e.company_id=q.company_id and e.kind='invoice' and e.action='status_changed' and e.changes->>'status_after'='issued' and e.created_at>=period_start and e.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.invoices i where i.company_id=q.company_id and i.status='issued' and public.billing_safe_document_date(i.document->>'dueDate')<local_today) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.quotes d where d.company_id=q.company_id and d.status='sent') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'planning') then (select count(*)::int from public.planning_task t where t.company_id=q.company_id and t.start_datetime>=period_end and t.start_datetime<period_end+interval '7 days') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'analytics') then (select coalesce(sum(a.page_views),0)::int from public.analytics_daily a where a.company_id=q.company_id and a.day>=q.week_start and a.day<q.week_start+7) else 0 end;
end $$;

create or replace function public.complete_company_weekly_summary(p_queue uuid,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
begin
  update public.company_weekly_summary_queue set status='sent',sent_at=now(),locked_at=null,provider_message_id=left(p_provider_id,200),last_error_code=null,updated_at=now()
  where id=p_queue and status='sending' and locked_at>now()-interval '20 hours';
  return found;
end $$;

create or replace function public.fail_company_weekly_summary(p_queue uuid,p_error_code text,p_retryable boolean default true,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_weekly_summary_queue;
begin
  select * into q from public.company_weekly_summary_queue where id=p_queue and status='sending' for update;
  if not found then return false; end if;
  update public.company_weekly_summary_queue set
    status=case when p_retryable and q.attempt_count<8 and p_error_code<>'sent_marker_failed' then 'queued' else 'dead' end,
    available_at=now()+least(interval '1 hour',interval '30 seconds'*power(2,greatest(q.attempt_count-1,0))),
    locked_at=null,provider_message_id=coalesce(left(p_provider_id,200),provider_message_id),
    last_error_code=case when p_error_code in('provider_unavailable','provider_rejected','recipient_unavailable','disabled','sent_marker_failed','unexpected_failure') then p_error_code else 'unexpected_failure' end,updated_at=now()
  where id=p_queue;
  return true;
end $$;

create or replace function public.purge_company_weekly_summary_queue()
returns integer language plpgsql security definer set search_path='' set row_security=off as $$
declare removed integer;
begin
  delete from public.company_weekly_summary_queue where (status='sent' and sent_at<now()-interval '90 days') or (status in('dead','skipped') and updated_at<now()-interval '180 days');
  get diagnostics removed=row_count; return removed;
end $$;

revoke all on function public.get_company_weekly_summary_settings(uuid) from public,anon;
revoke all on function public.save_company_weekly_summary_settings(uuid,boolean,time) from public,anon;
grant execute on function public.get_company_weekly_summary_settings(uuid),public.save_company_weekly_summary_settings(uuid,boolean,time) to authenticated;
revoke all on function public.enqueue_company_weekly_summaries(timestamptz),public.claim_company_weekly_summary_batch(integer),public.get_company_weekly_summary_payload(uuid),public.complete_company_weekly_summary(uuid,text),public.fail_company_weekly_summary(uuid,text,boolean,text),public.purge_company_weekly_summary_queue() from public,anon,authenticated;
grant execute on function public.enqueue_company_weekly_summaries(timestamptz),public.claim_company_weekly_summary_batch(integer),public.get_company_weekly_summary_payload(uuid),public.complete_company_weekly_summary(uuid,text),public.fail_company_weekly_summary(uuid,text,boolean,text),public.purge_company_weekly_summary_queue() to service_role;
commit;
