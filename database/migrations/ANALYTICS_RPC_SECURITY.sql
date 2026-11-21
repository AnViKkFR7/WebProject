-- Apply after ANALYTICS_AGGREGATION, COMPANY_MEMBER_ACCESS and COMPANY_MODULES.
-- Existing cron jobs run as their scheduling role (normally the owner).
begin;
revoke all on function public.aggregate_analytics_rollup(date,uuid),public.purge_old_analytics_events() from public,anon,authenticated;
grant execute on function public.aggregate_analytics_rollup(date,uuid),public.purge_old_analytics_events() to service_role;
alter function public.aggregate_analytics_rollup(date,uuid) set search_path='';
alter function public.purge_old_analytics_events() set search_path='';

create or replace function public.trigger_company_analytics_aggregation(target_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or target_company_id is null or not coalesce(
    public.is_platform_admin() or public.has_company_role(target_company_id,array['admin','editor']),false
  ) then raise exception 'Forbidden' using errcode='42501'; end if;
  if not coalesce(public.is_company_module_enabled(target_company_id,'analytics'),false) then
    raise exception 'Company module is disabled' using errcode='42501';
  end if;
  perform public.aggregate_analytics_rollup(current_date,target_company_id);
end $$;
revoke all on function public.trigger_company_analytics_aggregation(uuid) from public,anon,authenticated;
grant execute on function public.trigger_company_analytics_aggregation(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
