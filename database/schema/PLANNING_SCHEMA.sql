-- Planning — RLS para client_company, planning_task y billing
-- Ver admin-panel/BDD.sql para el esquema completo de estas tablas.
--
-- Estas tres tablas ya existen pero no tenían ninguna política RLS
-- versionada en el repo: sin esto, cualquier usuario autenticado podía
-- potencialmente leer/escribir los clientes, tareas y facturación de
-- CUALQUIER empresa tenant, no solo la suya.
--
-- Usa los mismos helpers que el resto del esquema (DB_SCHEMA.sql):
-- is_platform_admin(), is_company_member(), has_company_role().
--
-- Pegar y ejecutar en el SQL Editor de Supabase.

alter table public.client_company enable row level security;
alter table public.planning_task enable row level security;
alter table public.billing enable row level security;

-- ============================================================
-- client_company — empresas cliente que gestiona cada empresa tenant
-- ============================================================
drop policy if exists "client_company_select_tenant" on public.client_company;
create policy "client_company_select_tenant"
on public.client_company
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

drop policy if exists "client_company_write_tenant" on public.client_company;
create policy "client_company_write_tenant"
on public.client_company
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

-- ============================================================
-- planning_task
-- ============================================================
drop policy if exists "planning_task_select_tenant" on public.planning_task;
create policy "planning_task_select_tenant"
on public.planning_task
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

drop policy if exists "planning_task_write_tenant" on public.planning_task;
create policy "planning_task_write_tenant"
on public.planning_task
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

-- ============================================================
-- billing
-- ============================================================
drop policy if exists "billing_select_tenant" on public.billing;
create policy "billing_select_tenant"
on public.billing
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

drop policy if exists "billing_write_tenant" on public.billing;
create policy "billing_write_tenant"
on public.billing
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

-- ============================================================
-- Índices — el frontend ahora consulta siempre por (company_id,
-- client_company_id) además de por rango de fechas
-- ============================================================
create index if not exists client_company_company_id_idx
  on public.client_company (company_id);

create index if not exists planning_task_company_client_idx
  on public.planning_task (company_id, client_company_id, start_datetime);

create index if not exists billing_company_client_idx
  on public.billing (company_id, client_company_id, billing_date);

-- FIN
