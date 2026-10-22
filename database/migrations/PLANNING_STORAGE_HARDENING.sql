-- Bucket privado y acceso por empresa. Compatible con adjuntos antiguos referenciados.
begin;
update storage.buckets set public=false where id='media-planner';

-- Congelar una sola vez la pertenencia de los ficheros antiguos. No confiar en
-- referencias JSON editables para autorizar: podrían apuntar a archivos de otro tenant.
do $$
begin
  if to_regclass('public.planner_legacy_files') is null then
    create table public.planner_legacy_files (
      path text primary key, company_id uuid not null references public.companies(id) on delete cascade,
      created_at timestamptz not null default now()
    );
    insert into public.planner_legacy_files(path,company_id)
    select path,(array_agg(distinct company_id))[1] from (
      select r.company_id,coalesce(nullif(f->>'path',''),
        nullif(split_part(split_part(f->>'url','/storage/v1/object/public/media-planner/',2),'?',1),'')) as path
      from (select company_id,attachments from public.planning_task
        union all select company_id,attachments from public.billing) r
      cross join lateral jsonb_array_elements(case when jsonb_typeof(r.attachments)='array' then r.attachments else '[]'::jsonb end) f
      where r.company_id is not null
    ) refs where path is not null
      and exists(select 1 from storage.objects o where o.bucket_id='media-planner' and o.name=refs.path)
    group by path having count(distinct company_id)=1;
    -- Las referencias ambiguas entre empresas quedan bloqueadas hasta revisión manual.
  end if;
end $$;
alter table public.planner_legacy_files enable row level security;
revoke all on public.planner_legacy_files from public,anon,authenticated;

create or replace function public.can_access_planner_object(p_name text,p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare tenant uuid;
begin
  if auth.uid() is null then return false; end if;
  if public.is_platform_admin() then return true; end if;
  if split_part(p_name,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    tenant:=split_part(p_name,'/',1)::uuid;
    return case when p_write then public.has_company_role(tenant,array['admin','editor'])
      else public.is_company_member(tenant) end;
  end if;
  return exists(select 1 from public.planner_legacy_files f where f.path=p_name
    and case when p_write then public.has_company_role(f.company_id,array['admin','editor'])
      else public.is_company_member(f.company_id) end);
end $$;
revoke all on function public.can_access_planner_object(text,boolean) from public;
grant execute on function public.can_access_planner_object(text,boolean) to authenticated,anon;

-- Restrictivas: protegen este bucket incluso si existe alguna política antigua demasiado amplia.
drop policy if exists planner_read_guard on storage.objects;
create policy planner_read_guard on storage.objects as restrictive for select to public
using(bucket_id <> 'media-planner' or public.can_access_planner_object(name,false));
drop policy if exists planner_insert_guard on storage.objects;
create policy planner_insert_guard on storage.objects as restrictive for insert to public
with check(bucket_id <> 'media-planner' or public.can_access_planner_object(name,true));
drop policy if exists planner_update_guard on storage.objects;
create policy planner_update_guard on storage.objects as restrictive for update to public
using(bucket_id <> 'media-planner' or public.can_access_planner_object(name,true))
with check(bucket_id <> 'media-planner' or public.can_access_planner_object(name,true));
drop policy if exists planner_delete_guard on storage.objects;
create policy planner_delete_guard on storage.objects as restrictive for delete to public
using(bucket_id <> 'media-planner' or public.can_access_planner_object(name,true));

drop policy if exists planner_select on storage.objects;
create policy planner_select on storage.objects for select to authenticated
using(bucket_id='media-planner' and public.can_access_planner_object(name,false));
drop policy if exists planner_insert on storage.objects;
create policy planner_insert on storage.objects for insert to authenticated
with check(bucket_id='media-planner' and public.can_access_planner_object(name,true));
drop policy if exists planner_update on storage.objects;
create policy planner_update on storage.objects for update to authenticated
using(bucket_id='media-planner' and public.can_access_planner_object(name,true))
with check(bucket_id='media-planner' and public.can_access_planner_object(name,true));
drop policy if exists planner_delete on storage.objects;
create policy planner_delete on storage.objects for delete to authenticated
using(bucket_id='media-planner' and public.can_access_planner_object(name,true));
commit;
