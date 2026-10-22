-- Aplicar tras PLANNING_SCHEMA.sql. Las referencias existentes incompatibles detienen
-- la migración sin cambiar datos: revisar primero las consultas de BILLING_SECURITY_AUDIT.sql.
begin;
create unique index if not exists client_company_tenant_id_unique on public.client_company(company_id,id);
alter table public.planning_task drop constraint if exists planning_task_client_same_tenant;
alter table public.planning_task add constraint planning_task_client_same_tenant foreign key(company_id,client_company_id)
  references public.client_company(company_id,id);
alter table public.billing drop constraint if exists billing_client_same_tenant;
alter table public.billing add constraint billing_client_same_tenant foreign key(company_id,client_company_id)
  references public.client_company(company_id,id);

-- No permitir mover registros ya creados entre tenants, incluso si se es miembro de ambos.
create or replace function public.keep_planning_tenant()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.company_id is null or (tg_op='UPDATE' and new.company_id is distinct from old.company_id) then
    raise exception 'Tenant is required and cannot be changed' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists keep_planning_tenant on public.client_company;
create trigger keep_planning_tenant before insert or update on public.client_company
for each row execute function public.keep_planning_tenant();
drop trigger if exists keep_planning_tenant on public.planning_task;
create trigger keep_planning_tenant before insert or update on public.planning_task
for each row execute function public.keep_planning_tenant();
drop trigger if exists keep_planning_tenant on public.billing;
create trigger keep_planning_tenant before insert or update on public.billing
for each row execute function public.keep_planning_tenant();
revoke all on function public.keep_planning_tenant() from public,anon,authenticated;
commit;
