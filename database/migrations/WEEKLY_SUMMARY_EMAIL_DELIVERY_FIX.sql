-- Apply after WEEKLY_SUMMARY_EMAIL_WATCH_TEST_FIX.sql.
-- Supabase auth.users.email is varchar; RPC recipients must be text[].
begin;

create or replace function public.get_company_weekly_summary_payload(p_queue uuid)
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
    coalesce((select array_agg(distinct u.email::text order by u.email::text) from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=q.company_id and m.role='admin' and m.is_active and nullif(btrim(u.email),'') is not null),array[]::text[]),
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.lead l where l.company_id=q.company_id and l.created_at>=period_start and l.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.crm_contacts c where c.company_id=q.company_id and c.created_at>=period_start and c.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.crm_contacts c left join public.crm_pipeline_stages s on s.id=c.stage_id and s.company_id=c.company_id where c.company_id=q.company_id and c.next_follow_up_at<now() and not coalesce(s.is_won,false) and not coalesce(s.is_lost,false)) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.billing_document_events e where e.company_id=q.company_id and e.kind='invoice' and e.action='status_changed' and e.changes->>'status_after'='issued' and e.created_at>=period_start and e.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.invoices i where i.company_id=q.company_id and i.status='issued' and public.billing_safe_document_date(i.document->>'dueDate')<local_today) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.quotes d where d.company_id=q.company_id and d.status='sent') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'planning') then (select count(*)::int from public.planning_task t where t.company_id=q.company_id and t.start_datetime>=period_end and t.start_datetime<period_end+interval '7 days') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'analytics') then (select coalesce(sum(a.page_views),0)::int from public.analytics_daily a where a.company_id=q.company_id and a.day>=q.week_start and a.day<q.week_start+7) else 0 end;
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
    coalesce((select array_agg(distinct u.email::text order by u.email::text) from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=q.company_id and m.role='admin' and m.is_active and nullif(btrim(u.email),'') is not null),array[]::text[]),
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.lead l where l.company_id=q.company_id and l.created_at>=period_start and l.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.crm_contacts c where c.company_id=q.company_id and c.created_at>=period_start and c.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.crm_contacts c left join public.crm_pipeline_stages s on s.id=c.stage_id and s.company_id=c.company_id where c.company_id=q.company_id and c.next_follow_up_at<now() and not coalesce(s.is_won,false) and not coalesce(s.is_lost,false)) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.billing_document_events e where e.company_id=q.company_id and e.kind='invoice' and e.action='status_changed' and e.changes->>'status_after'='issued' and e.created_at>=period_start and e.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.invoices i where i.company_id=q.company_id and i.status='issued' and public.billing_safe_document_date(i.document->>'dueDate')<local_today) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.quotes d where d.company_id=q.company_id and d.status='sent') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'planning') then (select count(*)::int from public.planning_task t where t.company_id=q.company_id and t.start_datetime>=period_end and t.start_datetime<period_end+interval '7 days') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'analytics') then (select coalesce(sum(a.page_views),0)::int from public.analytics_daily a where a.company_id=q.company_id and a.day>=q.week_start and a.day<q.week_start+7) else 0 end;
end $$;

revoke all on function public.get_company_weekly_summary_payload(uuid),public.get_watch_weekly_summary_test_payload(uuid) from public,anon,authenticated;
grant execute on function public.get_company_weekly_summary_payload(uuid),public.get_watch_weekly_summary_test_payload(uuid) to service_role;

-- Permit one recovery attempt of the failed test, retaining its UUID and
-- Resend generation (1). The 20-hour boundary is below Resend's 24-hour
-- idempotency retention. No rows are deleted or automatically retried.
alter table public.company_weekly_summary_watch_test
  drop constraint if exists company_weekly_summary_watch_test_attempt_count_check;
alter table public.company_weekly_summary_watch_test
  add constraint company_weekly_summary_watch_test_attempt_count_check check(attempt_count between 1 and 2);

create or replace function public.claim_watch_weekly_summary_test()
returns table(queue_id uuid,company_id uuid,week_start date,delivery_generation integer)
language plpgsql security definer set search_path='' set row_security=off as $$
declare target_company uuid; matching_companies integer; target_week date; test_id uuid;
  previous_test public.company_weekly_summary_watch_test;
begin
  select count(*)::integer into matching_companies from public.companies c where c.name='WatchEcommerceDemo';
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
  select t.* into previous_test from public.company_weekly_summary_watch_test t where t.company_id=target_company for update;
  if found then
    if previous_test.status='dead' and previous_test.last_error_code='unexpected_failure'
       and previous_test.provider_message_id is null and previous_test.attempt_count=1
       and previous_test.created_at>now()-interval '20 hours' then
      update public.company_weekly_summary_watch_test t
      set status='sending',attempt_count=2,locked_at=now(),completed_at=null,last_error_code=null
      where t.id=previous_test.id returning t.id into test_id;
    else
      raise exception 'Test already requested; recovery is unavailable or outside the safe idempotency window' using errcode='23505';
    end if;
  else
    target_week:=(date_trunc('week',now() at time zone 'Europe/Madrid')::date-7);
    insert into public.company_weekly_summary_watch_test(company_id,week_start,status,attempt_count,locked_at)
    values(target_company,target_week,'sending',1,now()) returning id into test_id;
  end if;
  return query select t.id,t.company_id,t.week_start,1 from public.company_weekly_summary_watch_test t where t.id=test_id;
end $$;
revoke all on function public.claim_watch_weekly_summary_test() from public,anon,authenticated;
grant execute on function public.claim_watch_weekly_summary_test() to service_role;

commit;
