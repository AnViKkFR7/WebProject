-- Shared client directory only. Apply after BILLING_DIRECTORY_CATALOG,
-- COMPANY_MEMBER_ACCESS, COMPANY_MODULES and COMPANY_MODULES_RPC_COMPLETION.
begin;

create function public.assert_client_directory_access(p_company uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if auth.uid() is null or p_company is null or not coalesce(
    public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if not (public.is_company_module_enabled(p_company,'planning') or public.is_company_module_enabled(p_company,'billing')) then
    raise exception 'Company module is disabled' using errcode='42501';
  end if;
end $$;
revoke all on function public.assert_client_directory_access(uuid) from public,anon,authenticated,service_role;

drop policy if exists client_company_module_gate on public.client_company;
create policy client_company_module_gate on public.client_company as restrictive for all to authenticated
using(public.is_company_module_enabled(company_id,'planning') or public.is_company_module_enabled(company_id,'billing'))
with check(public.is_company_module_enabled(company_id,'planning') or public.is_company_module_enabled(company_id,'billing'));

-- Replace only the directory trigger. Every other table keeps its own module.
create function public.guard_client_directory_module_write()
returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare target_company uuid;
begin
  target_company:=case when tg_op='DELETE' then old.company_id else new.company_id end;
  if target_company is null or not (public.is_company_module_enabled(target_company,'planning') or public.is_company_module_enabled(target_company,'billing')) then
    raise exception 'Company module is disabled' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old;end if;
  return new;
end $$;
revoke all on function public.guard_client_directory_module_write() from public,anon,authenticated,service_role;
drop trigger if exists guard_company_module_write on public.client_company;
create trigger guard_company_module_write before insert or update or delete on public.client_company
for each row execute function public.guard_client_directory_module_write();

create or replace function public.save_client_company(p_company uuid,p_id uuid,p_name text,p_tax_id text,p_billing_address text,p_email text,p_phone text,p_responsible text,p_color text)
returns public.client_company language plpgsql security definer set search_path='' as $$
declare result public.client_company;
begin
  perform public.assert_client_directory_access(p_company);
  p_name:=trim(coalesce(p_name,''));p_tax_id:=trim(coalesce(p_tax_id,''));p_billing_address:=trim(coalesce(p_billing_address,''));
  p_email:=trim(coalesce(p_email,''));p_phone:=trim(coalesce(p_phone,''));p_responsible:=trim(coalesce(p_responsible,''));
  if length(p_name) not between 1 and 300 or length(p_tax_id)>100 or length(p_billing_address)>2000 or length(p_email)>320 or length(p_phone)>100 or length(p_responsible)>300
    or (coalesce(p_color,'')<>'' and p_color !~ '^#[0-9A-Fa-f]{6}$') then raise exception 'Invalid client data' using errcode='22023'; end if;
  if p_id is null then
    insert into public.client_company(company_id,user_id,name,tax_id,billing_address,email,phone,responsible,color,updated_by)
    values(p_company,auth.uid(),p_name,nullif(p_tax_id,''),nullif(p_billing_address,''),nullif(p_email,''),nullif(p_phone,''),nullif(p_responsible,''),coalesce(nullif(p_color,''),'#1976d2'),auth.uid()) returning * into result;
  else
    update public.client_company set name=p_name,tax_id=nullif(p_tax_id,''),billing_address=nullif(p_billing_address,''),email=nullif(p_email,''),phone=nullif(p_phone,''),responsible=nullif(p_responsible,''),
      color=coalesce(nullif(p_color,''),color),updated_at=now(),updated_by=auth.uid()
    where id=p_id and company_id=p_company and archived_at is null returning * into result;
    if result.id is null then raise exception 'Client changed or unavailable' using errcode='40001'; end if;
  end if;
  return result;
end $$;

create or replace function public.archive_client_company(p_company uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_client_directory_access(p_company);
  update public.client_company set archived_at=now(),updated_at=now(),updated_by=auth.uid() where id=p_id and company_id=p_company and archived_at is null;
  if not found then raise exception 'Client changed or unavailable' using errcode='40001'; end if;
end $$;

-- RPCs retain signatures, validation, audit metadata and archival semantics.
revoke all on public.client_company from public,anon,authenticated;
grant select on public.client_company to authenticated;
revoke all on function public.save_client_company(uuid,uuid,text,text,text,text,text,text,text),public.archive_client_company(uuid,uuid) from public,anon;
grant execute on function public.save_client_company(uuid,uuid,text,text,text,text,text,text,text),public.archive_client_company(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
