-- One-shot, tenant-scoped delivery check for the weekly summary.
-- Apply after WEEKLY_SUMMARY_EMAIL.sql and WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql.
-- This creates an isolated test ledger and never inserts into or claims the
-- production weekly-summary queue.
begin;

create table if not exists public.company_weekly_summary_watch_test (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  week_start date not null,
  status text not null check(status in ('sending','sent','dead')),
  attempt_count integer not null default 1 check(attempt_count=1),
  locked_at timestamptz not null default now(),
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.company_weekly_summary_watch_test enable row level security;
revoke all on public.company_weekly_summary_watch_test from public,anon,authenticated,service_role;

create or replace function public.claim_watch_weekly_summary_test()
returns table(queue_id uuid,company_id uuid,week_start date,delivery_generation integer)
language plpgsql security definer set search_path='' set row_security=off as $$
declare target_company uuid; matching_companies integer; target_week date; test_id uuid;
begin
  select count(*)::integer into matching_companies
  from public.companies c where c.name='WatchEcommerceDemo';
  if matching_companies<>1 then
    raise exception 'Expected exactly one WatchEcommerceDemo company' using errcode='P0002';
  end if;
  select c.id into target_company from public.companies c where c.name='WatchEcommerceDemo';
  if not exists(select 1 from public.company_weekly_summary_settings s where s.company_id=target_company and s.enabled) then
    raise exception 'Weekly summary is not enabled for WatchEcommerceDemo' using errcode='55000';
  end if;
  if not exists(select 1 from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=target_company and m.role='admin' and m.is_active and nullif(btrim(u.email),'') is not null) then
    raise exception 'No active administrator email for WatchEcommerceDemo' using errcode='55000';
  end if;
  target_week:=(date_trunc('week',now() at time zone 'Europe/Madrid')::date-7);
  insert into public.company_weekly_summary_watch_test(company_id,week_start,status,attempt_count,locked_at)
  values(target_company,target_week,'sending',1,now())
  on conflict(company_id) do nothing returning id into test_id;
  if test_id is null then
    raise exception 'The one-shot WatchEcommerceDemo weekly summary test was already requested' using errcode='23505';
  end if;
  return query select t.id,t.company_id,t.week_start,1 from public.company_weekly_summary_watch_test t where t.id=test_id;
end $$;

create or replace function public.get_watch_weekly_summary_test_payload(p_queue uuid)
returns table(company_id uuid,week_start date,week_end date,recipient_emails text[],new_leads integer,new_contacts integer,overdue_followups integer,issued_invoices integer,overdue_invoices integer,quotes_waiting integer,upcoming_planning integer,page_views integer)
language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_weekly_summary_watch_test; period_start timestamptz; period_end timestamptz; local_today date;
begin
  select * into q from public.company_weekly_summary_watch_test t where t.id=p_queue and t.status='sending' and t.locked_at>now()-interval '20 hours';
  if not found or not exists(select 1 from public.companies c where c.id=q.company_id and c.name='WatchEcommerceDemo') then return; end if;
  if not exists(select 1 from public.company_weekly_summary_settings s where s.company_id=q.company_id and s.enabled) then return; end if;
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

create or replace function public.complete_watch_weekly_summary_test(p_queue uuid,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
begin
  update public.company_weekly_summary_watch_test set status='sent',provider_message_id=left(p_provider_id,200),last_error_code=null,completed_at=now()
  where id=p_queue and status='sending' and locked_at>now()-interval '20 hours';
  return found;
end $$;

create or replace function public.fail_watch_weekly_summary_test(p_queue uuid,p_error_code text,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
begin
  update public.company_weekly_summary_watch_test set status='dead',provider_message_id=coalesce(left(p_provider_id,200),provider_message_id),
    last_error_code=case when p_error_code in('provider_unavailable','provider_rejected','recipient_unavailable','sent_marker_failed','unexpected_failure') then p_error_code else 'unexpected_failure' end,
    completed_at=now()
  where id=p_queue and status='sending';
  return found;
end $$;

revoke all on function public.claim_watch_weekly_summary_test(),public.get_watch_weekly_summary_test_payload(uuid),public.complete_watch_weekly_summary_test(uuid,text),public.fail_watch_weekly_summary_test(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_watch_weekly_summary_test(),public.get_watch_weekly_summary_test_payload(uuid),public.complete_watch_weekly_summary_test(uuid,text),public.fail_watch_weekly_summary_test(uuid,text,text) to service_role;

commit;
