-- Apply after DB_SCHEMA.sql. Membership removal never deletes auth.users or authored data.
begin;
alter table public.company_members add column if not exists is_active boolean not null default true;

create or replace function public.has_company_role(_company_id uuid, _roles text[])
returns boolean language sql stable security definer set search_path = pg_catalog, public set row_security = off as $$
  select exists(select 1 from public.company_members cm where cm.company_id = _company_id
    and cm.user_id = auth.uid() and cm.is_active and cm.role = any(_roles))
$$;
create or replace function public.is_company_member(_company_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public set row_security = off as $$
  select exists(select 1 from public.company_members cm where cm.company_id = _company_id
    and cm.user_id = auth.uid() and cm.is_active)
$$;

-- Sensitive changes go through the serialized RPCs, including when permissive old policies exist.
-- The owner and service_role remain available for trusted migrations/platform Edge functions.
create or replace function public.guard_company_member_access()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user = 'service_role' or current_user = pg_get_userbyid((select relowner from pg_class where oid = 'public.company_members'::regclass)) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then raise exception 'Use manage_company_member' using errcode = '42501'; end if;
  if (new.company_id,new.user_id,new.role,new.is_active) is distinct from (old.company_id,old.user_id,old.role,old.is_active) then
    raise exception 'Membership access changes require an authorized RPC' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_company_member_access on public.company_members;
create trigger guard_company_member_access before update or delete on public.company_members
for each row execute function public.guard_company_member_access();

create or replace function public.manage_company_member(p_company uuid,p_user uuid,p_action text)
returns void language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
declare target public.company_members%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  -- Serialize against removals, suspensions and role changes in this company.
  perform 1 from public.companies where id=p_company for update;
  if not (public.is_platform_admin() or public.has_company_role(p_company,array['admin'])) then
    raise exception 'Company administrator required' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('suspend','reactivate','remove') then raise exception 'Invalid action'; end if;
  select * into target from public.company_members where company_id=p_company and user_id=p_user for update;
  if not found then raise exception 'Member not found in this company'; end if;
  if p_action <> 'reactivate' and p_user=auth.uid() then raise exception 'Cannot remove or suspend your own access'; end if;
  if not public.is_platform_admin() and exists(select 1 from auth.users where id=p_user and raw_app_meta_data->>'app_role'='admin') then
    raise exception 'Platform administrators cannot be managed by company administrators' using errcode='42501';
  end if;
  if p_action <> 'reactivate' and target.role='admin' and target.is_active and not exists(
    select 1 from public.company_members where company_id=p_company and user_id<>p_user and role='admin' and is_active
  ) then raise exception 'At least one active company administrator is required'; end if;
  if p_action='remove' then
    delete from public.company_members where company_id=p_company and user_id=p_user;
  else
    update public.company_members set is_active=(p_action='reactivate') where company_id=p_company and user_id=p_user;
  end if;
end $$;

create or replace function public.update_company_member(p_company uuid,p_user uuid,p_name text,p_phone text,p_role text default null)
returns void language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
declare target public.company_members%rowtype; admin_access boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.companies where id=p_company for update;
  admin_access := public.is_platform_admin() or public.has_company_role(p_company,array['admin']);
  if not (admin_access or public.has_company_role(p_company,array['editor'])) then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into target from public.company_members where company_id=p_company and user_id=p_user for update;
  if not found then raise exception 'Member not found in this company'; end if;
  if p_name is null or length(p_name)>1000 or length(p_phone)>100 then raise exception 'Invalid profile'; end if;
  if p_role is not null and p_role is distinct from target.role then
    if p_role not in ('admin','editor','viewer') then raise exception 'Invalid role'; end if;
    if not admin_access and not (target.role='viewer' and p_role='editor') then raise exception 'Forbidden role change' using errcode='42501'; end if;
    if not public.is_platform_admin() and exists(select 1 from auth.users where id=p_user and raw_app_meta_data->>'app_role'='admin') then raise exception 'Protected platform administrator' using errcode='42501'; end if;
    if target.role='admin' and target.is_active and not exists(select 1 from public.company_members where company_id=p_company and user_id<>p_user and role='admin' and is_active) then
      raise exception 'At least one active company administrator is required';
    end if;
  end if;
  update public.company_members set full_name=p_name,phone=coalesce(p_phone,''),role=coalesce(p_role,target.role)
    where company_id=p_company and user_id=p_user;
end $$;
revoke all on function public.manage_company_member(uuid,uuid,text) from public,anon;
revoke all on function public.update_company_member(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.manage_company_member(uuid,uuid,text) to authenticated;
grant execute on function public.update_company_member(uuid,uuid,text,text,text) to authenticated;
commit;
