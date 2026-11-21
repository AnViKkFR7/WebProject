-- Allows exactly one additional isolated delivery after the original
-- WatchEcommerceDemo test was confirmed sent. Each activation has its own
-- request key and Resend idempotency key. Never touches the normal queue.
begin;

alter table public.company_weekly_summary_watch_test
  drop constraint if exists company_weekly_summary_watch_test_company_id_key;

alter table public.company_weekly_summary_watch_test
  add column if not exists request_key uuid;

update public.company_weekly_summary_watch_test
set request_key=gen_random_uuid()
where request_key is null;

alter table public.company_weekly_summary_watch_test
  alter column request_key set default gen_random_uuid(),
  alter column request_key set not null;

create unique index if not exists company_weekly_summary_watch_test_request_key_uidx
  on public.company_weekly_summary_watch_test(request_key);

drop function if exists public.claim_watch_weekly_summary_test();

create function public.claim_watch_weekly_summary_test(p_request_key uuid)
returns table(queue_id uuid,company_id uuid,week_start date,delivery_generation integer)
language plpgsql security definer set search_path='' set row_security=off as $$
declare target_company uuid; matching_companies integer; target_week date; test_id uuid; prior_count integer; prior_status text;
begin
  if p_request_key is null then
    raise exception 'A unique test request key is required' using errcode='22023';
  end if;
  select count(*)::integer into matching_companies from public.companies c where c.name='WatchEcommerceDemo';
  if matching_companies<>1 then
    raise exception 'Expected exactly one WatchEcommerceDemo company' using errcode='P0002';
  end if;
  select c.id into target_company from public.companies c where c.name='WatchEcommerceDemo';
  perform pg_advisory_xact_lock(hashtextextended(target_company::text,0));
  if exists(select 1 from public.company_weekly_summary_watch_test t where t.request_key=p_request_key) then
    raise exception 'This test request key was already used' using errcode='23505';
  end if;
  if not exists(select 1 from public.company_weekly_summary_settings s where s.company_id=target_company and s.enabled) then
    raise exception 'Weekly summary is not enabled for WatchEcommerceDemo' using errcode='55000';
  end if;
  if not exists(select 1 from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=target_company and m.role='admin' and m.is_active and nullif(btrim(u.email),'') is not null) then
    raise exception 'No active administrator email for WatchEcommerceDemo' using errcode='55000';
  end if;
  select count(*)::integer,max(t.status) into prior_count,prior_status
  from public.company_weekly_summary_watch_test t where t.company_id=target_company;
  if prior_count<>1 or prior_status<>'sent' then
    raise exception 'A confirmed successful test is required and only one resend is permitted' using errcode='55000';
  end if;
  target_week:=(date_trunc('week',now() at time zone 'Europe/Madrid')::date-7);
  insert into public.company_weekly_summary_watch_test(company_id,week_start,status,attempt_count,locked_at,request_key)
  values(target_company,target_week,'sending',1,now(),p_request_key) returning id into test_id;
  return query select t.id,t.company_id,t.week_start,1 from public.company_weekly_summary_watch_test t where t.id=test_id;
end $$;

revoke all on function public.claim_watch_weekly_summary_test(uuid) from public,anon,authenticated;
grant execute on function public.claim_watch_weekly_summary_test(uuid) to service_role;

commit;
