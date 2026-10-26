-- Module configuration is controlled only by the platform administrator.
-- Company members retain read access because the panel must hide disabled modules.
begin;

drop policy if exists company_modules_update_admin on public.company_modules;
drop policy if exists company_modules_update_platform_admin on public.company_modules;
create policy company_modules_update_platform_admin on public.company_modules for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

revoke update on public.company_modules from public,anon,authenticated;

create or replace function public.set_company_module(
  p_company uuid,
  p_module_key text,
  p_is_enabled boolean
)
returns public.company_modules
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare result public.company_modules;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_company is null or p_module_key is null or p_module_key not in ('items','blog','crm','planning','billing','analytics') or p_is_enabled is null then
    raise exception 'Invalid module setting' using errcode='22023';
  end if;

  update public.company_modules
  set is_enabled=p_is_enabled
  where company_id=p_company and module_key=p_module_key
  returning * into result;
  if not found then raise exception 'Company module not found' using errcode='P0002'; end if;
  return result;
end;
$$;

revoke all on function public.set_company_module(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.set_company_module(uuid,text,boolean) to authenticated;

commit;
