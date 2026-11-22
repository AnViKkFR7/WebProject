-- Hallazgo H (auditoría 22/11/2026, deriva de producción). SECURITY_AUDIT_CHECKS.sql
-- mostró en producción:
--   1) RLS DESACTIVADA en client_company, planning_task, billing, attached_file y
--      client_company_members. Con la clave pública de las webs (anon) se podían leer
--      y modificar clientes, tareas y movimientos de TODAS las empresas: sin RLS las
--      políticas existen pero no se aplican.
--   2) anon con INSERT/UPDATE/DELETE/TRUNCATE en todas las tablas (permisos por
--      defecto de Supabase; producción nunca ejecutó bootstrap/FINAL_ACCESS.sql).
--   3) aggregate_analytics_daily (función antigua, no está en el repositorio) y
--      save_invoice_profile ejecutables por anon.
--
-- Esta migración deja producción como el repositorio. Idempotente. El panel no
-- cambia de comportamiento: ya filtraba por empresa y las políticas son las mismas
-- con las que corren las pruebas. Las webs solo necesitan leer contenido publicado.
begin;

-- 1) Políticas del repositorio (se recrean por si faltan; sin ellas, activar RLS
--    dejaría al panel sin acceso). attached_file y client_company_members no tienen
--    políticas a propósito: el panel no las usa y quedan cerradas al navegador.
drop policy if exists "client_company_select_tenant" on public.client_company;
create policy "client_company_select_tenant" on public.client_company for select to authenticated
using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "client_company_write_tenant" on public.client_company;
create policy "client_company_write_tenant" on public.client_company for all to authenticated
using (public.is_platform_admin() or public.has_company_role(company_id, array['admin', 'editor']))
with check (public.is_platform_admin() or public.has_company_role(company_id, array['admin', 'editor']));
drop policy if exists client_company_module_gate on public.client_company;
create policy client_company_module_gate on public.client_company as restrictive for all to authenticated
using (public.is_company_module_enabled(company_id,'planning') or public.is_company_module_enabled(company_id,'billing'))
with check (public.is_company_module_enabled(company_id,'planning') or public.is_company_module_enabled(company_id,'billing'));

drop policy if exists "planning_task_select_tenant" on public.planning_task;
create policy "planning_task_select_tenant" on public.planning_task for select to authenticated
using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "planning_task_write_tenant" on public.planning_task;
create policy "planning_task_write_tenant" on public.planning_task for all to authenticated
using (public.is_platform_admin() or public.has_company_role(company_id, array['admin', 'editor']))
with check (public.is_platform_admin() or public.has_company_role(company_id, array['admin', 'editor']));
drop policy if exists planning_task_module_gate on public.planning_task;
create policy planning_task_module_gate on public.planning_task as restrictive for all to authenticated
using (public.is_company_module_enabled(company_id,'planning')) with check (public.is_company_module_enabled(company_id,'planning'));

drop policy if exists "billing_select_tenant" on public.billing;
create policy "billing_select_tenant" on public.billing for select to authenticated
using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "billing_write_tenant" on public.billing;
create policy "billing_write_tenant" on public.billing for all to authenticated
using (public.is_platform_admin() or public.has_company_role(company_id, array['admin', 'editor']))
with check (public.is_platform_admin() or public.has_company_role(company_id, array['admin', 'editor']));
drop policy if exists planning_billing_module_gate on public.billing;
create policy planning_billing_module_gate on public.billing as restrictive for all to authenticated
using (public.is_company_module_enabled(company_id,'planning')) with check (public.is_company_module_enabled(company_id,'planning'));

-- 2) Activar RLS.
alter table public.client_company enable row level security;
alter table public.planning_task enable row level security;
alter table public.billing enable row level security;
alter table public.attached_file enable row level security;
alter table public.client_company_members enable row level security;

-- 3) anon: solo lectura del contenido que muestran las webs (como FINAL_ACCESS.sql).
revoke all on all tables in schema public from anon;
grant select on public.companies, public.items, public.attribute_definitions, public.attribute_values,
  public.item_media, public.item_media_summary, public.blog_posts, public.blog_media to anon;
-- TRUNCATE no pasa por RLS: nunca para roles del navegador.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
-- Tablas nuevas creadas desde el Dashboard: sin permisos automáticos para anon.
alter default privileges in schema public revoke all on tables from anon;

-- 4) Funciones que anon no debe ejecutar (todas sus sobrecargas).
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'aggregate_analytics_daily' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'save_invoice_profile' loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
