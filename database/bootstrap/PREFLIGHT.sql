-- Only a clean application schema in an already initialized Supabase project.
do $$ begin
 if current_setting('server_version_num')::integer<150000 then raise exception 'PostgreSQL 15+ required';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p','v','m','S','f'))
  or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'))
  or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype in('d','e','r','m')
   and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'))
 then raise exception 'Bootstrap requires an empty public schema';end if;
 if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null
  or to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
  raise exception 'Initialize Supabase Auth and Storage before application bootstrap';
 end if;
 if not exists(select 1 from pg_roles where rolname='service_role') or not exists(select 1 from pg_roles where rolname='authenticated')
  or not exists(select 1 from pg_roles where rolname='anon') then raise exception 'Supabase roles required';end if;
end $$;
revoke create on schema public from public,anon,authenticated;
alter default privileges in schema public revoke all on tables from public,anon,authenticated;
