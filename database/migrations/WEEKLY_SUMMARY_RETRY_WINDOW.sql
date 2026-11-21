-- Apply after WEEKLY_SUMMARY_EMAIL_AUTOMATIC and DELIVERY_FIX when installed.
-- Coordinate with send-weekly-summary; no provider request is made here.
begin;
alter table public.company_weekly_summary_queue add column first_attempt_at timestamptz;
-- Existing attempted jobs have no reliable first-attempt timestamp. Creation is
-- a conservative lower bound, never a refreshed lock that extends deduplication.
update public.company_weekly_summary_queue set first_attempt_at=created_at where attempt_count>0;

create or replace function public.claim_company_weekly_summary_batch(p_limit integer default 20)
returns table(queue_id uuid,company_id uuid,week_start date,delivery_generation integer)
language plpgsql security definer set search_path='' set row_security=off as $$
begin
 if p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Invalid batch size' using errcode='22023';end if;
 update public.company_weekly_summary_queue q set status='dead',locked_at=null,last_error_code='sent_marker_failed',updated_at=now()
 where q.status in('queued','sending') and (q.provider_message_id is not null
   or (q.attempt_count>0 and (q.first_attempt_at is null or q.first_attempt_at<=now()-interval '20 hours')));
 update public.company_weekly_summary_queue q set status='dead',locked_at=null,last_error_code='unexpected_failure',updated_at=now()
 where q.attempt_count>=8 and (q.status='queued' or(q.status='sending' and q.locked_at<now()-interval '10 minutes'));
 return query with claimed as (
   select q.id from public.company_weekly_summary_queue q
   where (q.status='queued' and q.available_at<=now() or q.status='sending' and q.locked_at<now()-interval '10 minutes')
     and q.attempt_count<8 and q.provider_message_id is null
     and (q.first_attempt_at is null or q.first_attempt_at>now()-interval '20 hours')
   order by q.available_at,q.created_at for update skip locked limit p_limit
 ) update public.company_weekly_summary_queue q set status='sending',locked_at=now(),
   first_attempt_at=coalesce(q.first_attempt_at,now()),attempt_count=q.attempt_count+1,updated_at=now()
 from claimed c where q.id=c.id returning q.id,q.company_id,q.week_start,q.delivery_generation;
end $$;

create function public.validate_company_weekly_summary_delivery(p_queue uuid,p_generation integer)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_weekly_summary_queue;
begin
 select * into q from public.company_weekly_summary_queue where id=p_queue for update;
 if not found or q.status<>'sending' or q.delivery_generation is distinct from p_generation then return false;end if;
 if q.first_attempt_at is null or q.first_attempt_at<=now()-interval '20 hours' or q.provider_message_id is not null then
   update public.company_weekly_summary_queue set status='dead',locked_at=null,last_error_code='sent_marker_failed',updated_at=now() where id=q.id;
   return false;
 end if;
 if not exists(select 1 from public.company_weekly_summary_settings where company_id=q.company_id and enabled) then
   update public.company_weekly_summary_queue set status='skipped',locked_at=null,last_error_code='disabled',updated_at=now() where id=q.id;
   return false;
 end if;
 return coalesce(q.locked_at>now()-interval '10 minutes',false);
end $$;
revoke all on function public.validate_company_weekly_summary_delivery(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.validate_company_weekly_summary_delivery(uuid,integer) to service_role;

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
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.billing_document_events e where e.company_id=q.company_id and e.kind='invoice' and e.action='status_changed' and e.changes->>'status_after'='issued' and e.created_at>=period_start and e.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.invoices i where i.company_id=q.company_id and i.status='issued' and public.billing_safe_document_date(i.document->>'dueDate')<local_today) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.quotes d where d.company_id=q.company_id and d.status='sent') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'planning') then (select count(*)::int from public.planning_task t where t.company_id=q.company_id and t.start_datetime>=period_end and t.start_datetime<period_end+interval '7 days') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'analytics') then (select coalesce(sum(a.page_views),0)::int from public.analytics_daily a where a.company_id=q.company_id and a.day>=q.week_start and a.day<q.week_start+7) else 0 end;
end $$;

create or replace function public.fail_company_weekly_summary(p_queue uuid,p_error_code text,p_retryable boolean default true,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_weekly_summary_queue;
begin
  select * into q from public.company_weekly_summary_queue where id=p_queue and status='sending' for update;
  if not found then return false; end if;
  update public.company_weekly_summary_queue set
    status=case when p_retryable and q.attempt_count<8 and p_error_code<>'sent_marker_failed' and p_provider_id is null and q.provider_message_id is null and q.first_attempt_at>now()-interval '20 hours' then 'queued' else 'dead' end,
    available_at=now()+least(interval '1 hour',interval '30 seconds'*power(2,greatest(q.attempt_count-1,0))),
    locked_at=null,provider_message_id=coalesce(left(p_provider_id,200),provider_message_id),
    last_error_code=case when q.first_attempt_at is null or q.first_attempt_at<=now()-interval '20 hours' or p_provider_id is not null or q.provider_message_id is not null then 'sent_marker_failed' when p_error_code in('provider_unavailable','provider_rejected','recipient_unavailable','disabled','sent_marker_failed','unexpected_failure') then p_error_code else 'unexpected_failure' end,updated_at=now()
  where id=p_queue;
  return true;
end $$;

-- A provider confirmation may arrive after the guard quarantined the lease.
-- Retain verified delivery rather than leaving an accepted email retryable.
create or replace function public.complete_company_weekly_summary(p_queue uuid,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
begin
 update public.company_weekly_summary_queue set status='sent',sent_at=now(),locked_at=null,
   provider_message_id=coalesce(left(p_provider_id,200),provider_message_id),last_error_code=null,updated_at=now()
 where id=p_queue and (status='sending' or(status='dead' and last_error_code='sent_marker_failed' and nullif(p_provider_id,'') is not null));
 return found;
end $$;

notify pgrst,'reload schema';
commit;
