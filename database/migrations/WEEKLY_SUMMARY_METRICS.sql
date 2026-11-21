-- After WEEKLY_SUMMARY_RETRY_WINDOW, BILLING_RECTIFICATION_BALANCES and PLANNING_RECURRENCE_WINDOW.
begin;
create function public.weekly_summary_issued_count(p_company uuid,p_from timestamptz,p_to timestamptz)
returns integer language sql stable security definer set search_path='' set row_security=off as $$
 select count(*)::int from (
  select e.record_id,min(e.created_at) first_issue from public.billing_document_events e
  where e.company_id=p_company and e.kind='invoice' and (
   e.action='created' and e.snapshot->>'status' in('issued','paid') or
   e.changes->>'status_after' in('issued','paid') and coalesce(e.changes->>'status_before','') not in('issued','paid'))
  and not exists(select 1 from public.billing_document_events baseline where baseline.company_id=e.company_id and baseline.kind='invoice'
   and baseline.record_id=e.record_id and baseline.action='baseline' and baseline.snapshot->>'status' in('issued','paid'))
  group by e.record_id
 ) firsts where first_issue>=p_from and first_issue<p_to;
$$;
create function public.weekly_summary_overdue_count(p_company uuid,p_today date)
returns integer language sql stable security definer set search_path='' set row_security=off as $$
 select count(*)::int from public.invoice_family_financials(p_company) f
 join public.invoices i on i.id=f.current_id and i.company_id=p_company
 where f.invoice_id=f.current_id and i.status='issued' and f.total-f.paid>0
 and public.billing_safe_document_date(i.document->>'dueDate')<p_today;
$$;
create function public.weekly_summary_planning_count(p_company uuid,p_from timestamptz,p_to timestamptz)
returns integer language sql stable security definer set search_path='' set row_security=off as $$
 with series as (
  select t.*,public.planning_recurrence_step(t.recurrence_type,t.recurrence_value) step
  from public.planning_task t where company_id=p_company and start_datetime<p_to
 ), occurrences as (
  select s.id,s.start_datetime occurrence_at from series s where step is null
  union all
  select s.id,public.planning_occurrence_at(s.start_datetime,s.step,n,s.recurrence_type)
  from series s cross join lateral generate_series(
   greatest(public.planning_recurrence_index(s.start_datetime,p_from,s.recurrence_type,s.recurrence_value)-1,0),
   greatest(public.planning_recurrence_index(s.start_datetime,p_to,s.recurrence_type,s.recurrence_value)+1,0)
  ) n where s.step is not null
 ) select count(*)::int from occurrences where occurrence_at>=p_from and occurrence_at<p_to;
$$;
revoke all on function public.weekly_summary_issued_count(uuid,timestamptz,timestamptz),public.weekly_summary_overdue_count(uuid,date),public.weekly_summary_planning_count(uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;
create or replace function public.get_company_weekly_summary_payload(p_queue uuid)
returns table(company_id uuid,week_start date,week_end date,recipient_emails text[],new_leads integer,new_contacts integer,overdue_followups integer,issued_invoices integer,overdue_invoices integer,quotes_waiting integer,upcoming_planning integer,page_views integer)
language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_weekly_summary_queue; period_start timestamptz; period_end timestamptz; local_today date;
begin
  select * into q from public.company_weekly_summary_queue where id=p_queue and status='sending' and locked_at>now()-interval '10 minutes' and first_attempt_at>now()-interval '20 hours';
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
    case when public.is_company_module_enabled(q.company_id,'billing') then public.weekly_summary_issued_count(q.company_id,period_start,period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then public.weekly_summary_overdue_count(q.company_id,local_today) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.quotes d where d.company_id=q.company_id and d.status='sent') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'planning') then public.weekly_summary_planning_count(q.company_id,period_end,(q.week_start+14)::timestamp at time zone 'Europe/Madrid') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'analytics') then (select coalesce(sum(a.page_views),0)::int from public.analytics_daily a where a.company_id=q.company_id and a.day>=q.week_start and a.day<q.week_start+7) else 0 end;
end $$;


-- Patch the optional Watch payload only when already installed; never activate it.
do $patch$ declare definition text;begin
 if to_regprocedure('public.get_watch_weekly_summary_test_payload(uuid)') is not null then
  definition:=pg_get_functiondef('public.get_watch_weekly_summary_test_payload(uuid)'::regprocedure);
  if position('(select count(*)::int from public.billing_document_events e where e.company_id=q.company_id and e.kind=''invoice'' and e.action=''status_changed'' and e.changes->>''status_after''=''issued'' and e.created_at>=period_start and e.created_at<period_end)' in definition)=0 then raise exception 'Unexpected Watch payload definition; review before applying';end if;
  definition:=replace(definition,'(select count(*)::int from public.billing_document_events e where e.company_id=q.company_id and e.kind=''invoice'' and e.action=''status_changed'' and e.changes->>''status_after''=''issued'' and e.created_at>=period_start and e.created_at<period_end)','public.weekly_summary_issued_count(q.company_id,period_start,period_end)');
  if position('(select count(*)::int from public.invoices i where i.company_id=q.company_id and i.status=''issued'' and public.billing_safe_document_date(i.document->>''dueDate'')<local_today)' in definition)=0 then raise exception 'Unexpected Watch payload definition; review before applying';end if;
  definition:=replace(definition,'(select count(*)::int from public.invoices i where i.company_id=q.company_id and i.status=''issued'' and public.billing_safe_document_date(i.document->>''dueDate'')<local_today)','public.weekly_summary_overdue_count(q.company_id,local_today)');
  if position('(select count(*)::int from public.planning_task t where t.company_id=q.company_id and t.start_datetime>=period_end and t.start_datetime<period_end+interval ''7 days'')' in definition)=0 then raise exception 'Unexpected Watch payload definition; review before applying';end if;
  definition:=replace(definition,'(select count(*)::int from public.planning_task t where t.company_id=q.company_id and t.start_datetime>=period_end and t.start_datetime<period_end+interval ''7 days'')','public.weekly_summary_planning_count(q.company_id,period_end,(q.week_start+14)::timestamp at time zone ''Europe/Madrid'')');
  execute definition;
 end if;
end $patch$;
notify pgrst,'reload schema';
commit;
