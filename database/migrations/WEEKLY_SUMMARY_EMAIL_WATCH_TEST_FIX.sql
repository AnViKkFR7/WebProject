-- Fixes the ambiguous ON CONFLICT target in the already-applied
-- WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql RPC. Apply once before retrying the
-- one-shot maintenance request. No queue or membership rows are changed.
begin;

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
  if exists(select 1 from public.company_weekly_summary_watch_test t where t.company_id=target_company) then
    raise exception 'The one-shot WatchEcommerceDemo weekly summary test was already requested' using errcode='23505';
  end if;
  target_week:=(date_trunc('week',now() at time zone 'Europe/Madrid')::date-7);
  insert into public.company_weekly_summary_watch_test(company_id,week_start,status,attempt_count,locked_at)
  values(target_company,target_week,'sending',1,now()) returning id into test_id;
  return query select t.id,t.company_id,t.week_start,1 from public.company_weekly_summary_watch_test t where t.id=test_id;
end $$;

revoke all on function public.claim_watch_weekly_summary_test() from public,anon,authenticated;
grant execute on function public.claim_watch_weekly_summary_test() to service_role;

commit;
